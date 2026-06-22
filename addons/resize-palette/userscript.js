export default async function ({ addon, console, msg }) {
  const DEFAULT_WIDTH = 250; // Scratch's hardcoded flyout width
  const MIN_WIDTH = 100;
  const MAX_WIDTH = 800;
  const STORAGE_KEY = "sa-resize-palette-width";

  const Blockly = await addon.tab.traps.getBlockly();

  const clamp = (w) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));

  // The user-chosen flyout width in px, or null to use Scratch's default.
  let width = null;
  if (addon.settings.get("remember")) {
    const stored = parseFloat(localStorage.getItem(STORAGE_KEY));
    if (stored > 0) width = clamp(stored);
  }

  let mainFlyout = null;
  let divider = null;
  let injectionDiv = null;
  let flyoutEl = null;
  let dragging = false;
  let resizeObserver = null;
  let mutationObserver = null;

  const getWorkspace = () => addon.tab.traps.getWorkspace();
  const getFlyout = () => {
    const toolbox = getWorkspace()?.getToolbox?.();
    return (toolbox && toolbox.getFlyout && toolbox.getFlyout()) || null;
  };

  // Scratch's flyout uses a fixed getWidth() (250); override it so the main toolbox
  // flyout reports our custom width instead. Patched on the prototype so it survives
  // the flyout being re-created (theme/locale changes), guarded to the main flyout only.
  function patchFlyout(flyout) {
    const proto = flyout.constructor.prototype;
    if (proto.__saResizePalettePatched) return;
    proto.__saResizePalettePatched = true;
    const oldGetWidth = proto.getWidth;
    proto.getWidth = function () {
      if (!addon.self.disabled && width !== null && this === mainFlyout) return width;
      return oldGetWidth.call(this);
    };
  }

  function applyLayout() {
    const workspace = getWorkspace();
    const flyout = getFlyout();
    if (!workspace || !flyout) return;
    try {
      if (flyout.reflow) flyout.reflow();
      Blockly.svgResize(workspace);
      if (flyout.position) flyout.position();
    } catch (e) {
      console.error(e);
    }
    repositionDivider();
  }

  function repositionDivider() {
    if (!divider || !injectionDiv) return;
    flyoutEl = injectionDiv.querySelector(".blocklyFlyout");
    if (addon.self.disabled || !flyoutEl) {
      divider.style.display = "none";
      return;
    }
    // Hidden by the "Auto-hiding block palette" (hide-flyout) addon, or otherwise off-screen.
    const closed = flyoutEl.classList.contains("sa-flyoutClose");
    const containerRect = injectionDiv.getBoundingClientRect();
    const flyoutRect = flyoutEl.getBoundingClientRect();
    if (closed || flyoutRect.width < 2 || flyoutRect.right <= containerRect.left + 2) {
      divider.style.display = "none";
      return;
    }
    divider.style.display = "";
    divider.style.left = `${flyoutRect.right - containerRect.left}px`;
  }

  function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    flyoutEl = injectionDiv.querySelector(".blocklyFlyout");
    if (!flyoutEl) return;
    width = clamp(e.clientX - flyoutEl.getBoundingClientRect().left);
    applyLayout();
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("sa-resize-palette-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    if (addon.settings.get("remember") && width !== null) {
      localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
    }
  }

  function startDrag(e) {
    e.preventDefault();
    if (width === null) width = DEFAULT_WIDTH;
    dragging = true;
    document.body.classList.add("sa-resize-palette-dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  }

  function reset() {
    width = null;
    localStorage.removeItem(STORAGE_KEY);
    applyLayout();
  }

  function makeDivider() {
    const el = document.createElement("div");
    el.className = "sa-resize-palette-divider";
    el.title = msg("drag-tooltip");
    el.addEventListener("pointerdown", startDrag);
    el.addEventListener("dblclick", reset);
    return el;
  }

  addon.self.addEventListener("disabled", () => {
    endDrag();
    applyLayout();
    if (divider) divider.style.display = "none";
  });
  addon.self.addEventListener("reenabled", () => applyLayout());

  window.addEventListener("resize", () => {
    if (!dragging) repositionDivider();
  });
  addon.tab.redux.initialize();
  addon.tab.redux.addEventListener("statechanged", () => {
    if (!dragging) requestAnimationFrame(repositionDivider);
  });

  while (true) {
    flyoutEl = await addon.tab.waitForElement(".blocklyFlyout", {
      markAsSeen: true,
      reduxEvents: [
        "scratch-gui/mode/SET_PLAYER",
        "scratch-gui/locales/SELECT_LOCALE",
        "scratch-gui/settings/SET_COLOR_MODE",
        "scratch-gui/settings/SET_THEME",
        "fontsLoaded/SET_FONTS_LOADED",
      ],
      reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
    });
    injectionDiv = document.querySelector(".injectionDiv");
    mainFlyout = getFlyout();
    if (mainFlyout) patchFlyout(mainFlyout);

    if (!divider) divider = makeDivider();
    if (injectionDiv && divider.parentElement !== injectionDiv) injectionDiv.appendChild(divider);

    if (mutationObserver) mutationObserver.disconnect();
    mutationObserver = new MutationObserver(() => {
      if (!dragging) repositionDivider();
    });
    mutationObserver.observe(flyoutEl, { attributes: true, attributeFilter: ["class", "style", "transform"] });

    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
      if (!dragging) repositionDivider();
    });
    resizeObserver.observe(flyoutEl);

    applyLayout();
  }
}
