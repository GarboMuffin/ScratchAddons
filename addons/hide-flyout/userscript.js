export default async function ({ addon, global, console }) {
  let placeHolderDiv = null;
  let lockDisplay = null;
  let toggle = true;
  let selectedCategory = null;
  let toggleSetting = addon.settings.get("toggle");
  let flyoutLock = false;

  let flyOut;
  let scrollBar;

  function positionElements() {
    placeHolderDiv.style.height = `${flyOut.getBoundingClientRect().height - 20}px`;
    placeHolderDiv.style.width = `${flyOut.getBoundingClientRect().width}px`;
    placeHolderDiv.style.top = `${flyOut.getBoundingClientRect().top}px`;
    lockDisplay.style.top = `${flyOut.getBoundingClientRect().top}px`;
  }
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
    flyOut.classList.remove("sa-flyoutClose");
    flyOut.style.transitionDuration = `${speed}s`;
    scrollBar.classList.remove("sa-flyoutClose");
    scrollBar.style.transitionDuration = `${speed}s`;
    lockDisplay.classList.remove("sa-flyoutClose");
    lockDisplay.style.transitionDuration = `${speed}s`;
    setTimeout(() => Blockly.getMainWorkspace().recordCachedAreas(), speed * 1000);
  }
  function onmouseleave(e, speed = getSpeedValue()) {
    // If we go behind the flyout or the user has locked it, let's return
    if (
      (toggleSetting !== "cathover" && e && e.clientX <= scrollBar.getBoundingClientRect().left) ||
      flyoutLock
    )
      return;
    flyOut.classList.add("sa-flyoutClose");
    flyOut.style.transitionDuration = `${speed}s`;
    scrollBar.classList.add("sa-flyoutClose");
    scrollBar.style.transitionDuration = `${speed}s`;
    lockDisplay.classList.add("sa-flyoutClose");
    lockDisplay.style.transitionDuration = `${speed}s`;
    setTimeout(() => Blockly.getMainWorkspace().recordCachedAreas(), speed * 1000);
  }

  if (toggleSetting === "category" || toggleSetting === "cathover") {
    (async () => {
      while (true) {
        let category = await addon.tab.waitForElement(".scratchCategoryMenuItem", { markAsSeen: true });
        category.onclick = (e) => {
          if (toggle && selectedCategory === category && toggleSetting === "category")
            onmouseleave(), (selectedCategory = category);
          else if (!toggle) onmouseenter(), (selectedCategory = category);
          else return (selectedCategory = category);
          if (toggleSetting === "category") toggle = !toggle;
        };
        if (toggleSetting === "cathover")
          (category.onmouseover = onmouseenter), (flyOut.onmouseleave = onmouseleave);
      }
    })();
  }

  addon.tab.redux.initialize();
  addon.tab.redux.addEventListener("statechanged", (e) => {
    switch (e.detail.action.type) {
      // Event casted when switch to small or normal size stage or when screen size changed.
      case "scratch-gui/StageSize/SET_STAGE_SIZE":
      case "scratch-gui/workspace-metrics/UPDATE_METRICS":
        positionElements();
        break;

      // Event casted when you switch between tabs
      case "scratch-gui/navigation/ACTIVATE_TAB":
        // always 0, 1, 2
        lockDisplay.style.display = e.detail.action.activeTabIndex === 0 ? "block" : "none";
        placeHolderDiv.style.display = e.detail.action.activeTabIndex === 0 ? "block" : "none";
        if (e.detail.action.activeTabIndex === 0)
          onmouseenter(0), positionElements(), (toggle = true);
        break;
      // Event casted when you switch between tabs
      case "scratch-gui/mode/SET_PLAYER":
        // always true or false
        lockDisplay.style.display = e.detail.action.isPlayerOnly ? "none" : "block";
        placeHolderDiv.style.display = e.detail.action.activeTabIndex === 0 ? "block" : "none";
        break;
    }
  });

  while (true) {
    flyOut = await addon.tab.waitForElement(".blocklyFlyout", { markAsSeen: true });
    let blocklySvg = await addon.tab.waitForElement(".blocklySvg", { markAsSeen: true });
    scrollBar = document.querySelector(".blocklyFlyoutScrollbar");

    // Placeholder Div
    if (placeHolderDiv) placeHolderDiv.remove();
    placeHolderDiv = document.createElement("div");
    if (toggleSetting === "hover") document.body.appendChild(placeHolderDiv);
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

    // Only append if we don't have "categoryclick" on
    if (toggleSetting === "hover") document.body.appendChild(lockDisplay);

    // position elements which closes flyout on load
    positionElements();
    if (toggleSetting === "hover")
      (placeHolderDiv.onmouseenter = onmouseenter), (blocklySvg.onmouseenter = onmouseleave);

    if (toggleSetting === "cathover") onmouseleave(null, 0);
  }
}
