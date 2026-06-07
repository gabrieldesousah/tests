chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.tabs.sendMessage(tab.id, { action: "toggle" }, (response) => {
    if (chrome.runtime.lastError) return;

    const active = Boolean(response?.active);
    chrome.action.setBadgeText({
      tabId: tab.id,
      text: active ? "ON" : "",
    });
    chrome.action.setBadgeBackgroundColor({
      tabId: tab.id,
      color: "#16a34a",
    });
    chrome.action.setTitle({
      tabId: tab.id,
      title: active
        ? "Desativar inspetor de cores (bg-*/text-*)"
        : "Ativar inspetor de cores (bg-*/text-*)",
    });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setTitle({
      tabId,
      title: "Ativar inspetor de cores (bg-*/text-*)",
    });
  }
});
