/**
 * Background Service Worker / Script for Robotistan Pro BOM to Cart Extension
 */

const ROBOTISTAN_ORIGINS = [
  "https://robotistanpro.com",
  "https://www.robotistanpro.com"
];

// When extension action icon is clicked in toolbar
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.url) return;

  const isRobotistan = ROBOTISTAN_ORIGINS.some((origin) => tab.url.startsWith(origin));

  if (isRobotistan) {
    // Send message to content script to toggle the BOM drawer
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_BOM_PANEL" });
    } catch (err) {
      // If content script was not ready, execute it or reload
      console.warn("Could not send message to tab, injecting content scripts:", err);
    }
  } else {
    // Open Robotistan Pro in a new tab or focus it
    chrome.tabs.create({ url: "https://robotistanpro.com" });
  }
});

// Generic message dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "OPEN_ROBOTISTAN_TAB") {
    chrome.tabs.create({ url: "https://robotistanpro.com" });
    sendResponse({ success: true });
    return true;
  }
});
