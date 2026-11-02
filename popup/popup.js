/**
 * Popup Script
 */

document.addEventListener("DOMContentLoaded", async () => {
  const onSiteView = document.getElementById("on-site-view");
  const offSiteView = document.getElementById("off-site-view");
  const openDrawerBtn = document.getElementById("open-drawer-btn");
  const goRobotistanBtn = document.getElementById("go-robotistan-btn");

  // Query active tab
  let activeTab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
    }
  } catch (err) {
    console.error("Tab query error:", err);
  }

  const isRobotistan = activeTab && activeTab.url && (
    activeTab.url.startsWith("https://robotistanpro.com") ||
    activeTab.url.startsWith("https://www.robotistanpro.com")
  );

  if (isRobotistan) {
    onSiteView.style.display = "flex";
    offSiteView.style.display = "none";

    openDrawerBtn.addEventListener("click", async () => {
      try {
        await chrome.tabs.sendMessage(activeTab.id, { action: "TOGGLE_BOM_PANEL" });
        window.close();
      } catch (err) {
        console.warn("Could not message active tab:", err);
      }
    });
  } else {
    onSiteView.style.display = "none";
    offSiteView.style.display = "flex";

    goRobotistanBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://robotistanpro.com" });
      window.close();
    });
  }
});
