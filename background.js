// Chrome invokes this command only while the browser is focused.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'capture-timestamp' || !tab?.id) return;
  // The content script is only present on supported YouTube watch pages.
  // Ignore a missing receiver (for example, a non-YouTube tab).
  chrome.tabs.sendMessage(tab.id, { type: 'capture-timestamp' }).catch(() => {});
});
