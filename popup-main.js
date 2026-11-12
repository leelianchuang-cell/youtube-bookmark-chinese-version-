
const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#f97316','#14b8a6'];
let pickColor = COLORS[0];
let activeFolder = '__all__';
let searchQ = '';
let language = 'zh';
const messages = {
  zh: {
    logo:'YouTube 时间点笔记', search:'搜索视频或笔记…', folders:'文件夹', add:'＋ 新建文件夹', modal:'📁 新建文件夹',
    folderHint:'如：金融学习、日常娱乐…', cancel:'取消', create:'✓ 创建', all:'全部视频', unfiled:'未归档',
    deleteFolder:'删除此文件夹？\n里面的视频笔记不受影响，只是取消归档。', count:n=>`${n} 个视频`,
    noResults:'没有找到匹配内容', empty:'这里还没有视频<br><br>在 YouTube 页面观看并保存笔记后，<br>点击视频笔记面板的 🗂 按钮归档',
    unarchive:'取消归档', notes:n=>`📝 ${n} 条笔记`, move:'🗂 归档', open:'▶ 打开', del:'✕ 删除',
    choose:'选择文件夹', onlyTime:'仅时间标记', noNotes:'暂无笔记', openVideo:'▶ 打开视频',
    deleteVideo:'删除该视频的所有笔记？此操作不可撤销。', export:'导出备份', import:'导入备份',
    replace:'导入将替换当前浏览器中的全部视频、笔记和文件夹。建议先导出备份。确定继续吗？',
    invalid:'备份文件无效或格式不受支持，原有数据未更改。', done:'备份已导入。', failed:'操作失败，原有数据未更改。',
  },
  en: {
    logo:'YouTube Time Notes', search:'Search videos or notes…', folders:'Folders', add:'＋ New folder', modal:'📁 New folder',
    folderHint:'e.g. Study, Entertainment…', cancel:'Cancel', create:'✓ Create', all:'All videos', unfiled:'Unfiled',
    deleteFolder:'Delete this folder?\nIts videos and notes will remain, but will no longer be filed.', count:n=>`${n} videos`,
    noResults:'No matches found', empty:'No videos yet.<br><br>Save a note on a YouTube video and use 🗂<br>in the video notes panel to file it.',
    unarchive:'Remove from folder', notes:n=>`📝 ${n} notes`, move:'🗂 File', open:'▶ Open', del:'✕ Delete',
    choose:'Choose a folder', onlyTime:'Time marker only', noNotes:'No notes', openVideo:'▶ Open video',
    deleteVideo:'Delete all notes for this video? This cannot be undone.', export:'Export backup', import:'Import backup',
    replace:'Import replaces all videos, notes, and folders in this browser. Export a backup first. Continue?',
    invalid:'Invalid or unsupported backup. Existing data was not changed.', done:'Backup imported.', failed:'Operation failed. Existing data was not changed.',
  }
};
const tr = key => messages[language][key];
function applyLanguage(){
  document.documentElement.lang=language==='en'?'en':'zh';
  for(const [id,key] of Object.entries({'logo-text':'logo','folder-label':'folders',addbtn:'add','modal-title':'modal',bno:'cancel',bok:'create','export-backup':'export','import-backup':'import'}))
    document.getElementById(id).textContent=tr(key);
  document.getElementById('search').placeholder=tr('search');
  document.getElementById('fname').placeholder=tr('folderHint');
  document.getElementById('language').value=language;
  render();
}

// ── storage helpers ──────────────────────────────────
function sget(k){ return new Promise(r=>chrome.storage.local.get(k,d=>r(d[k]??null))); }
function sset(k,v){ return new Promise(r=>chrome.storage.local.set({[k]:v},r)); }
async function loadFolders(){ return (await sget('folders'))||[]; }
async function loadVideos(){  return (await sget('videos')) ||{}; }

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtT(sec){
  sec=Math.floor(sec);
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60,p=n=>String(n).padStart(2,'0');
  return h?`${h}:${p(m)}:${p(s)}`:`${m}:${p(s)}`;
}
function fmtD(ts){
  if(!ts)return'';
  const d=new Date(ts),p=n=>String(n).padStart(2,'0');
  return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── main render ──────────────────────────────────────
async function render(){
  const [folders, vmap] = await Promise.all([loadFolders(), loadVideos()]);
  const videos = Object.values(vmap).sort((a,b)=>(b.lastVisited||0)-(a.lastVisited||0));
  drawFolders(folders, videos);
  drawVideos(folders, videos);
}

// ── 左侧文件夹 ───────────────────────────────────────
function drawFolders(folders, videos){
  const el = document.getElementById('flist');
  const items = [
    {id:'__all__',  name:tr('all'), color:'#6366f1', cnt:videos.length},
    {id:'__none__', name:tr('unfiled'), color:'#44445a', cnt:videos.filter(v=>!v.folderId).length},
    ...folders.map(f=>({id:f.id,name:f.name,color:f.color,cnt:videos.filter(v=>v.folderId===f.id).length,del:true}))
  ];
  el.innerHTML = items.map(x=>`
    <div class="fi ${activeFolder===x.id?'on':''}" data-id="${esc(x.id)}">
      <div class="fdot" style="background:${x.color}"></div>
      <div class="fname" title="${esc(x.name)}">${esc(x.name)}</div>
      <div class="fcnt">${x.cnt}</div>
      ${x.del?`<button class="fdelbtn" data-id="${esc(x.id)}">✕</button>`:''}
    </div>`).join('');

  el.querySelectorAll('.fi').forEach(fi=>{
    fi.addEventListener('click',e=>{
      if(e.target.classList.contains('fdelbtn'))return;
      activeFolder=fi.dataset.id;
      render();
    });
  });
  el.querySelectorAll('.fdelbtn').forEach(btn=>{
    btn.addEventListener('click',async e=>{
      e.stopPropagation();
      if(!confirm(tr('deleteFolder')))return;
      const [folders,vmap]=await Promise.all([loadFolders(),loadVideos()]);
      Object.values(vmap).forEach(v=>{if(v.folderId===btn.dataset.id)v.folderId=null;});
      await Promise.all([sset('folders',folders.filter(f=>f.id!==btn.dataset.id)),sset('videos',vmap)]);
      if(activeFolder===btn.dataset.id)activeFolder='__all__';
      render();
    });
  });
}

// ── 右侧视频列表 ─────────────────────────────────────
function drawVideos(folders, videos){
  // 1. 筛选文件夹
  let list = videos.filter(v=>{
    if(activeFolder==='__all__') return true;
    if(activeFolder==='__none__') return !v.folderId;
    return v.folderId===activeFolder;
  });

  // 2. 搜索
  if(searchQ){
    const q=searchQ.toLowerCase();
    list=list.filter(v=>v.title.toLowerCase().includes(q)||(v.notes||[]).some(n=>(n.text||'').toLowerCase().includes(q)));
  }

  // 3. 标题
  const tf=document.getElementById('ctitle');
  if(activeFolder==='__all__'){
    tf.textContent=tr('all');
  } else if(activeFolder==='__none__'){
    tf.textContent=tr('unfiled');
  } else {
    const f=folders.find(f=>f.id===activeFolder);
    tf.innerHTML=f?`<span class="tbadge" style="background:${f.color}"></span>${esc(f.name)}`:tr('folders');
  }
  document.getElementById('ccnt').textContent=tr('count')(list.length);

  const vl=document.getElementById('vlist');
  if(!list.length){
    vl.innerHTML=`<div class="empty"><div class="eico">${searchQ?'🔍':'📂'}</div>
      <p>${searchQ?tr('noResults'):tr('empty')}</p></div>`;
    return;
  }

  vl.innerHTML=list.map(v=>{
    const folder=folders.find(f=>f.id===v.folderId);
    const notes=v.notes||[];
    const matched=searchQ ? notes.filter(n=>(n.text||'').toLowerCase().includes(searchQ.toLowerCase())) : notes;
    const shownNotes=searchQ && matched.length ? matched : notes;
    // 归档菜单选项
    const mopts=[
      `<div class="mopt ${!v.folderId?'cur':''}" data-vid="${esc(v.id)}" data-fid="">
        <div class="moptdot" style="background:#44445a"></div>${tr('unarchive')}
      </div>`,
      ...folders.map(f=>`
        <div class="mopt ${v.folderId===f.id?'cur':''}" data-vid="${esc(v.id)}" data-fid="${esc(f.id)}">
          <div class="moptdot" style="background:${f.color}"></div>${esc(f.name)}
        </div>`)
    ].join('');

    return `
      <div class="vc" id="vc-${esc(v.id)}">
        <div class="vc-top" data-vid="${esc(v.id)}">
          <img class="vthumb" src="${esc(v.thumbnail)}">
          <div class="vinfo">
            <div class="vtitle" title="${esc(v.title)}">${esc(v.title)}</div>
            <div class="vmeta">
              <span class="tnotes">${tr('notes')(notes.length)}</span>
              ${folder?`<span class="tfolder" style="color:${folder.color};border-color:${folder.color}55;background:${folder.color}14">● ${esc(folder.name)}</span>`:''}
              <span class="tdate">${fmtD(v.lastVisited)}</span>
            </div>
          </div>
          <div class="vbtns">
            <button class="vbtn" data-act="move" data-vid="${esc(v.id)}">${tr('move')}</button>
            <button class="vbtn" data-act="open" data-url="${esc(v.url)}">${tr('open')}</button>
            <button class="vbtn del" data-act="del" data-vid="${esc(v.id)}">${tr('del')}</button>
          </div>
        </div>

        <div class="mmenu" id="mm-${esc(v.id)}">
          <div class="mmenu-title">${tr('choose')}</div>
          ${mopts}
        </div>

        <div class="npanel ${searchQ?'open':''}" id="np-${esc(v.id)}">
          ${shownNotes.length
            ? shownNotes.map(n=>`
                <div class="nrow">
                  <span class="nts" data-vid="${esc(v.id)}" data-t="${n.time}">${fmtT(n.time)}</span>
                  <span class="ntxt">${n.text?esc(n.text):`<em style="color:#3a3a55">${tr('onlyTime')}</em>`}</span>
                </div>`).join('')
            :`<div style="padding:11px 12px;color:#3a3a55;font-size:11px;text-align:center">${tr('noNotes')}</div>`
          }
          <div class="nfoot">
            <a class="golink" href="${esc(v.url)}" target="_blank">${tr('openVideo')}</a>
          </div>
        </div>
      </div>`;
  }).join('');

  // 点击卡片头部 → 展开笔记
  vl.querySelectorAll('.vc-top').forEach(top=>{
    top.addEventListener('click',e=>{
      if(e.target.closest('.vbtns'))return;
      const vid=top.dataset.vid;
      document.getElementById('np-'+vid)?.classList.toggle('open');
      // 关掉归档菜单
      document.getElementById('mm-'+vid)?.classList.remove('open');
    });
  });

  // 🗂 归档按钮
  vl.querySelectorAll('[data-act="move"]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const vid=btn.dataset.vid;
      // 关闭其他
      vl.querySelectorAll('.mmenu.open').forEach(m=>{if(m.id!=='mm-'+vid)m.classList.remove('open');});
      document.getElementById('mm-'+vid)?.classList.toggle('open');
      document.getElementById('np-'+vid)?.classList.remove('open');
    });
  });

  // 归档选项点击
  vl.querySelectorAll('.mopt').forEach(opt=>{
    opt.addEventListener('click',async e=>{
      e.stopPropagation();
      const vid=opt.dataset.vid, fid=opt.dataset.fid||null;
      const vmap=await loadVideos();
      if(vmap[vid]){ vmap[vid].folderId=fid; await sset('videos',vmap); }
      vl.querySelectorAll('.mmenu.open').forEach(m=>m.classList.remove('open'));
      render();
    });
  });

  // ▶ 打开视频
  vl.querySelectorAll('[data-act="open"]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      chrome.tabs.create({url:btn.dataset.url});
    });
  });

  // ✕ 删除
  vl.querySelectorAll('[data-act="del"]').forEach(btn=>{
    btn.addEventListener('click',async e=>{
      e.stopPropagation();
      if(!confirm(tr('deleteVideo')))return;
      const vmap=await loadVideos();
      delete vmap[btn.dataset.vid];
      await sset('videos',vmap);
      render();
    });
  });

  // 时间点跳转
  vl.querySelectorAll('.nts').forEach(el=>{
    el.addEventListener('click',e=>{
      e.stopPropagation();
      chrome.tabs.create({url:`https://www.youtube.com/watch?v=${el.dataset.vid}&t=${Math.floor(el.dataset.t)}`});
    });
  });

  // 点击空白处关闭归档菜单
  document.addEventListener('click',()=>vl.querySelectorAll('.mmenu.open').forEach(m=>m.classList.remove('open')),{once:true});
}

// ── 新建文件夹弹窗 ───────────────────────────────────
const overlay=document.getElementById('overlay');
const clrsEl=document.getElementById('clrs');

clrsEl.innerHTML=COLORS.map(c=>`<div class="clr ${c===pickColor?'on':''}" style="background:${c}" data-c="${c}"></div>`).join('');
clrsEl.querySelectorAll('.clr').forEach(sw=>{
  sw.addEventListener('click',()=>{
    clrsEl.querySelectorAll('.clr').forEach(s=>s.classList.remove('on'));
    sw.classList.add('on');
    pickColor=sw.dataset.c;
  });
});

document.getElementById('addbtn').addEventListener('click',()=>{
  document.getElementById('fname').value='';
  overlay.classList.add('open');
  setTimeout(()=>document.getElementById('fname').focus(),50);
});
document.getElementById('bno').addEventListener('click',()=>overlay.classList.remove('open'));
document.getElementById('bok').addEventListener('click',async()=>{
  const name=document.getElementById('fname').value.trim();
  if(!name){document.getElementById('fname').focus();return;}
  const folders=await loadFolders();
  folders.push({id:'f_'+Date.now(),name,color:pickColor,createdAt:Date.now()});
  await sset('folders',folders);
  overlay.classList.remove('open');
  render();
});
document.getElementById('fname').addEventListener('keydown',e=>{
  if(e.key==='Enter')document.getElementById('bok').click();
  if(e.key==='Escape')overlay.classList.remove('open');
});

// ── 搜索 ─────────────────────────────────────────────
document.getElementById('search').addEventListener('input',e=>{
  searchQ=e.target.value.trim();
  render();
});

// ── 语言 ─────────────────────────────────────────────
document.getElementById('language').addEventListener('change',async e=>{
  language=e.target.value==='en'?'en':'zh';
  await sset('language',language);
  applyLanguage();
});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local' && changes.language){language=changes.language.newValue==='en'?'en':'zh';applyLanguage();}
});

// Backups are deliberately versioned and validated before any storage write.
function validateBackup(data){
  const obj=x=>x!==null && typeof x==='object' && !Array.isArray(x);
  const str=(x,max)=>typeof x==='string' && x.length<=max;
  const timestamp=x=>x===undefined || (typeof x==='number' && Number.isFinite(x) && x>=0);
  if(!obj(data) || data.format!=='youtube-time-notes' || data.version!==1 ||
      !obj(data.videos) || !Array.isArray(data.folders) || data.folders.length>10000 ||
      Object.keys(data.videos).length>100000) throw Error('format');
  const folders=[], ids=new Set();
  for(const f of data.folders){
    if(!obj(f) || !str(f.id,100) || !/^f_[0-9]+$/.test(f.id) ||
       !str(f.name,1000) || !f.name.trim() || !str(f.color,7) || !/^#[0-9a-f]{6}$/i.test(f.color) ||
       !timestamp(f.createdAt)) throw Error('folder');
    ids.add(f.id); folders.push({id:f.id,name:f.name,color:f.color,createdAt:f.createdAt||0});
  }
  const videos={};
  for(const [key,v] of Object.entries(data.videos)){
    if(!/^[a-zA-Z0-9_-]{11}$/.test(key) || !obj(v) || v.id!==key || !str(v.title,10000) ||
       !str(v.url,10000) || !Array.isArray(v.notes) || v.notes.length>100000 ||
       !(v.folderId===null || v.folderId===undefined || ids.has(v.folderId)) ||
       !timestamp(v.createdAt) || !timestamp(v.lastVisited)) throw Error('video');
    let url;
    try { url=new URL(v.url); } catch { throw Error('url'); }
    if(url.protocol!=='https:' || url.hostname!=='www.youtube.com' || url.pathname!=='/watch' || url.searchParams.get('v')!==key) throw Error('url');
    const notes=[];
    for(const n of v.notes){
      if(!obj(n) || !str(n.id,100) || !/^n_[0-9]+$/.test(n.id) ||
         typeof n.time!=='number' || !Number.isFinite(n.time) || n.time<0 ||
         !str(n.text,100000) || !timestamp(n.createdAt)) throw Error('note');
      notes.push({id:n.id,time:n.time,text:n.text,createdAt:n.createdAt||0});
    }
    videos[key]={id:key,title:v.title,url:v.url,thumbnail:`https://img.youtube.com/vi/${key}/mqdefault.jpg`,
      folderId:v.folderId||null,notes,createdAt:v.createdAt||0,lastVisited:v.lastVisited||0};
  }
  return {videos,folders};
}
function setBackupData(value){
  return new Promise((resolve,reject)=>chrome.storage.local.set(value,()=>{
    if(chrome.runtime.lastError) reject(Error(chrome.runtime.lastError.message)); else resolve();
  }));
}
document.getElementById('export-backup').addEventListener('click',async ()=>{
  try {
    const [videos,folders]=await Promise.all([loadVideos(),loadFolders()]);
    const backup={format:'youtube-time-notes',version:1,exportedAt:new Date().toISOString(),videos,folders};
    const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
    const a=document.createElement('a'); a.href=url; a.download='youtube-time-notes-backup.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch { alert(tr('failed')); }
});
const backupFile=document.getElementById('backup-file');
document.getElementById('import-backup').addEventListener('click',()=>backupFile.click());
backupFile.addEventListener('change',async ()=>{
  const file=backupFile.files[0]; backupFile.value='';
  if(!file) return;
  let data;
  try {
    if(file.size>50*1024*1024) throw Error('too large');
    data=validateBackup(JSON.parse(await file.text()));
  } catch { alert(tr('invalid')); return; }
  if(!confirm(tr('replace'))) return;
  try { await setBackupData(data); activeFolder='__all__'; await render(); alert(tr('done')); }
  catch { alert(tr('failed')); }
});

sget('language').then(value=>{language=value==='en'?'en':'zh';applyLanguage();});
