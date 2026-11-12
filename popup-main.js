
const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#f97316','#14b8a6'];
let pickColor = COLORS[0];
let activeFolder = '__all__';
let searchQ = '';

// ── storage helpers ──────────────────────────────────
function sget(k){ return new Promise(r=>chrome.storage.local.get(k,d=>r(d[k]??null))); }
function sset(k,v){ return new Promise(r=>chrome.storage.local.set({[k]:v},r)); }
async function loadFolders(){ return (await sget('folders'))||[]; }
async function loadVideos(){  return (await sget('videos')) ||{}; }

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
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
    {id:'__all__',  name:'全部视频', color:'#6366f1', cnt:videos.length},
    {id:'__none__', name:'未归档',   color:'#44445a', cnt:videos.filter(v=>!v.folderId).length},
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
      if(!confirm('删除此文件夹？\n里面的视频笔记不受影响，只是取消归档。'))return;
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
    tf.innerHTML='全部视频';
  } else if(activeFolder==='__none__'){
    tf.innerHTML='未归档';
  } else {
    const f=folders.find(f=>f.id===activeFolder);
    tf.innerHTML=f?`<span class="tbadge" style="background:${f.color}"></span>${esc(f.name)}`:'文件夹';
  }
  document.getElementById('ccnt').textContent=`${list.length} 个视频`;

  const vl=document.getElementById('vlist');
  if(!list.length){
    vl.innerHTML=`<div class="empty"><div class="eico">${searchQ?'🔍':'📂'}</div>
      <p>${searchQ?'没有找到匹配内容':'这里还没有视频<br><br>在 YouTube 页面观看并保存笔记后，<br>点击视频右侧面板的 🗂 按钮归档到此文件夹'}</p></div>`;
    return;
  }

  vl.innerHTML=list.map(v=>{
    const folder=folders.find(f=>f.id===v.folderId);
    const notes=v.notes||[];
    // 归档菜单选项
    const mopts=[
      `<div class="mopt ${!v.folderId?'cur':''}" data-vid="${esc(v.id)}" data-fid="">
        <div class="moptdot" style="background:#44445a"></div>取消归档
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
              <span class="tnotes">📝 ${notes.length} 条笔记</span>
              ${folder?`<span class="tfolder" style="color:${folder.color};border-color:${folder.color}55;background:${folder.color}14">● ${esc(folder.name)}</span>`:''}
              <span class="tdate">${fmtD(v.lastVisited)}</span>
            </div>
          </div>
          <div class="vbtns">
            <button class="vbtn" data-act="move" data-vid="${esc(v.id)}">🗂 归档</button>
            <button class="vbtn" data-act="open" data-url="${esc(v.url)}">▶ 打开</button>
            <button class="vbtn del" data-act="del" data-vid="${esc(v.id)}">✕ 删除</button>
          </div>
        </div>

        <div class="mmenu" id="mm-${esc(v.id)}">
          <div class="mmenu-title">选择文件夹</div>
          ${mopts}
        </div>

        <div class="npanel" id="np-${esc(v.id)}">
          ${notes.length
            ? notes.map(n=>`
                <div class="nrow">
                  <span class="nts" data-vid="${esc(v.id)}" data-t="${n.time}">${fmtT(n.time)}</span>
                  <span class="ntxt">${n.text?esc(n.text):'<em style="color:#3a3a55">仅时间标记</em>'}</span>
                </div>`).join('')
            :'<div style="padding:11px 12px;color:#3a3a55;font-size:11px;text-align:center">暂无笔记</div>'
          }
          <div class="nfoot">
            <a class="golink" href="${esc(v.url)}" target="_blank">▶ 打开视频</a>
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
      if(!confirm('删除该视频的所有笔记？此操作不可撤销。'))return;
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

// ── 启动 ─────────────────────────────────────────────
render();
