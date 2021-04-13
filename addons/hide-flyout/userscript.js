export default async function ({ addon, global, console }) {
  let placeHolderDiv = null;
  let lockDisplay = null;
  let flyOut = null;
  let scrollBar = null;
  let toggle = true;
  let toggleSetting = addon.settings.get("toggle");
  let flyoutLock = false;

  function getSpeedValue() {
    let data = {
      none: "0",
      short: "0.25",
      default: "0.5",
      long: "1",
    };
    return data[addon.settings.get("speed")];
  }
  function onmouseenter(speed = {}) {
    speed = typeof speed === "object" ? getSpeedValue() : speed;
    flyOut.style.transitionDuration = `${speed}s`;
    scrollBar.style.transitionDuration = `${speed}s`;
    lockDisplay.style.transitionDuration = `${speed}s`;
    flyOut.classList.remove("sa-flyoutClose");
    scrollBar.classList.remove("sa-flyoutClose");
    lockDisplay.classList.remove("sa-flyoutClose");
    setTimeout(() => Blockly.getMainWorkspace().recordCachedAreas(), speed * 1000);
  }
  function onmouseleave(e, speed = getSpeedValue()) {
    // If we go behind the flyout or the user has locked it, let's return
    if ((toggleSetting !== "cathover" && e && e.clientX <= scrollBar.getBoundingClientRect().left) || flyoutLock)
      return;
    flyOut.style.transitionDuration = `${speed}s`;
    scrollBar.style.transitionDuration = `${speed}s`;
    lockDisplay.style.transitionDuration = `${speed}s`;
    flyOut.classList.add("sa-flyoutClose");
    scrollBar.classList.add("sa-flyoutClose");
    lockDisplay.classList.add("sa-flyoutClose");
    setTimeout(() => Blockly.getMainWorkspace().recordCachedAreas(), speed * 1000);
  }

  let didOneTimeSetup = false;
  function doOneTimeSetup() {
    if (didOneTimeSetup) {
      return;
    }
    didOneTimeSetup = true;
    if (toggleSetting === "category" || toggleSetting === "cathover") {
      (async () => {
        while (true) {
          let category = await addon.tab.waitForElement(".scratchCategoryMenuItem", { markAsSeen: true });
          category.addEventListener(
            "mouseup",
            () => {
              if (toggle && toggleSetting === "category" && category.classList.contains("categorySelected")) {
                onmouseleave();
              } else if (!toggle) {
                onmouseenter();
              } else {
                return;
              }
              if (toggleSetting === "category") toggle = !toggle;
            },
            true
          );
          if (toggleSetting === "cathover") {
            category.onmouseover = onmouseenter;
            flyOut.onmouseleave = onmouseleave;
          }
        }
      })();
    }
  }

  while (true) {
    flyOut = await addon.tab.waitForElement(".blocklyFlyout", { markAsSeen: true });
    let blocklySvg = await addon.tab.waitForElement(".blocklySvg", { markAsSeen: true });
    scrollBar = document.querySelector(".blocklyFlyoutScrollbar");

    // Placeholder Div
    if (placeHolderDiv) placeHolderDiv.remove();
    placeHolderDiv = document.createElement("div");
    placeHolderDiv.className = "sa-flyout-placeHolder";

    // Lock Img
    if (lockDisplay) lockDisplay.remove();
    lockDisplay = document.createElement("img");
    lockDisplay.src = addon.self.dir + `/${flyoutLock ? "" : "un"}lock.svg`;
    lockDisplay.className = "sa-lock-image";
    lockDisplay.onclick = () => {
      flyoutLock = !flyoutLock;
      lockDisplay.src = addon.self.dir + `/${flyoutLock ? "" : "un"}lock.svg`;
    };

    if (toggleSetting === "hover") {
      // The first tab panel will always be the code panel
      const tabPanel = document.querySelector("[class*='react-tabs_react-tabs__tab-panel']");
      tabPanel.appendChild(lockDisplay);
      tabPanel.appendChild(placeHolderDiv);
      placeHolderDiv.onmouseenter = onmouseenter;
      blocklySvg.onmouseenter = onmouseleave;
    }

    if (toggleSetting === "cathover") onmouseleave(null, 0);

    doOneTimeSetup();
  }
}
