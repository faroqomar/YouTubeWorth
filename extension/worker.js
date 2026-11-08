chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
chrome.action.onClicked.addListener(tab => {
  // Open while the click's user gesture is still active.
  chrome.sidePanel.open({windowId: tab.windowId}).then(() => {
    chrome.runtime.sendMessage({type:'worth-analyze',tabId:tab.id}).catch(() => {});
  }).catch(console.error);
});
