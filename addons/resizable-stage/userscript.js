export default async function ({ addon, console, msg }) {
  const NATIVE_W = 480; // Scratch's default (large) stage display width
  const ASPECT = 360 / 480; // stage is 4:3
  const MIN_STAGE_W = 180; // smallest stage we allow
  const MIN_CODE_WIDTH = 200; // keep at least this much code area, in px
  // Below SMALL_BELOW the wide sprite-pane layout no longer fits, so use Scratch's native
  // compact (small-stage) layout; switch back above LARGE_ABOVE. The gap is hysteresis to
  // avoid flicker while dragging across the boundary.
  const SMALL_BELOW = 450;
  const LARGE_ABOVE = 470;
  const STORAGE_KEY = "sa-resizable-stage-width";

  // The user-chosen stage display width in px, or null to follow Scratch's native size.
  let desiredW = null;
  if (addon.settings.get("remember")) {
    const stored = parseFloat(localStorage.getItem(STORAGE_KEY));
    if (stored > 0) desiredW = stored;
  }

  // The stage mode that was active before we started overriding, so we can restore it.
  let restoreMode = null;
  // Set true around our own SET_STAGE_SIZE dispatches so the listener ignores them.
  let selfDispatch = false;
  let padX = 16; // horizontal gap between the stage and the column edge (column padding)

  let flexWrapper, column, stageWrapper, stageEl, canvas, monitorScaler, handle;
  let dragging = false;
  let resizeObserver = null;

  const root = document.documentElement;
  const maxStageW = () => (addon.settings.get("allowLarger") ? NATIVE_W * 1.6 : NATIVE_W);

  function maxWidthForSpace() {
    if (!flexWrapper) return Infinity;
    const total = flexWrapper.getBoundingClientRect().width;
    const handleW = handle ? handle.getBoundingClientRect().width : 8;
    return total - handleW - MIN_CODE_WIDTH - padX;
  }

  function clampWidth(w) {
    w = Math.min(maxStageW(), Math.max(MIN_STAGE_W, w));
    w = Math.min(w, maxWidthForSpace());
    if (!(w >= MIN_STAGE_W)) w = MIN_STAGE_W;
    return w;
  }

  function isFullScreen() {
    return !!addon.tab.redux.state?.scratchGui?.mode?.isFullScreen;
  }

  function currentMode() {
    return addon.tab.redux.state?.scratchGui?.stageSize?.stageSize || "large";
  }

  function setMode(mode) {
    if (currentMode() === mode) return;
    selfDispatch = true;
    addon.tab.redux.dispatch({ type: "scratch-gui/StageSize/SET_STAGE_SIZE", stageSize: mode });
    selfDispatch = false;
  }

  // Keep the renderer resolution and variable-monitor scaling in sync with the canvas'
  // actual display size. Correct for both our custom sizes and Scratch's native modes
  // (Scratch positions monitors in 480-space and scales by displayWidth / 480).
  function syncRenderer() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const renderer = addon.tab.traps?.vm?.runtime?.renderer;
    if (renderer) renderer.resize(rect.width, rect.height);
    if (monitorScaler) monitorScaler.style.transform = `scale(${rect.width / NATIVE_W})`;
  }

  function removeVisualOverride() {
    document.body.classList.remove("sa-resizable-stage-active");
    root.style.removeProperty("--sa-rs-w");
    root.style.removeProperty("--sa-rs-h");
    if (stageWrapper) stageWrapper.style.width = "";
    if (column) {
      column.style.flex = "";
      column.style.width = "";
    }
  }

  function restoreNativeMode() {
    if (restoreMode !== null) {
      setMode(restoreMode);
      restoreMode = null;
    }
  }

  function chooseMode(w) {
    const cur = currentMode();
    if (w < SMALL_BELOW) return "small";
    if (w > LARGE_ABOVE) return "large";
    return cur; // within the hysteresis band: keep whatever's current
  }

  function apply() {
    if (!stageWrapper || !column || !canvas) return;

    // Suspended (full screen): drop the visual override but keep our intent + stage mode.
    if (isFullScreen()) {
      removeVisualOverride();
      syncRenderer();
      return;
    }
    // Inactive: restore Scratch's native size and the mode we found it in.
    if (desiredW === null) {
      removeVisualOverride();
      restoreNativeMode();
      syncRenderer();
      window.dispatchEvent(new Event("resize"));
      return;
    }

    if (restoreMode === null) restoreMode = currentMode();
    const w = clampWidth(desiredW);
    const h = w * ASPECT;

    // Switch Scratch's sprite-pane layout to match the width (native, no scaling).
    setMode(chooseMode(w));

    document.body.classList.add("sa-resizable-stage-active");
    root.style.setProperty("--sa-rs-w", `${w}px`);
    root.style.setProperty("--sa-rs-h", `${h}px`);
    // Narrow the stage wrapper so the header controls reflow with it (keeping their size),
    // and the column so the code area grows.
    stageWrapper.style.width = `${w}px`;
    column.style.flex = "0 0 auto";
    column.style.width = `${w + padX}px`;

    syncRenderer();
    // The mode switch re-renders asynchronously; re-sync the renderer afterwards.
    requestAnimationFrame(syncRenderer);
    window.dispatchEvent(new Event("resize"));
  }

  function measurePadding() {
    if (!stageWrapper || !column) return;
    const active = document.body.classList.contains("sa-resizable-stage-active");
    const prevW = stageWrapper.style.width;
    const prevColFlex = column.style.flex;
    const prevColW = column.style.width;
    stageWrapper.style.width = "";
    column.style.flex = "";
    column.style.width = "";
    const swRect = stageWrapper.getBoundingClientRect();
    const colRect = column.getBoundingClientRect();
    if (swRect.width) padX = Math.max(0, colRect.width - swRect.width);
    if (active) {
      stageWrapper.style.width = prevW;
      column.style.flex = prevColFlex;
      column.style.width = prevColW;
    }
  }

  function save() {
    if (!addon.settings.get("remember")) return;
    if (desiredW === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(Math.round(desiredW)));
  }

  function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const rect = flexWrapper.getBoundingClientRect();
    const columnWidth = rect.right - e.clientX;
    desiredW = clampWidth(columnWidth - padX);
    apply();
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("sa-resizable-stage-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    save();
    window.dispatchEvent(new Event("resize"));
  }

  function startDrag(e) {
    if (isFullScreen()) return;
    e.preventDefault();
    measurePadding();
    if (desiredW === null) desiredW = NATIVE_W;
    apply();
    dragging = true;
    document.body.classList.add("sa-resizable-stage-dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  }

  function makeHandle() {
    const el = document.createElement("div");
    el.className = "sa-resizable-stage-handle";
    el.title = msg("drag-tooltip");
    const grip = document.createElement("div");
    grip.className = "sa-resizable-stage-grip";
    el.appendChild(grip);
    el.addEventListener("pointerdown", startDrag);
    el.addEventListener("dblclick", () => {
      desiredW = null;
      apply();
      save();
    });
    return el;
  }

  function attachObserver() {
    if (resizeObserver || !canvas) return;
    resizeObserver = new ResizeObserver(() => {
      if (!dragging) syncRenderer();
    });
    resizeObserver.observe(canvas);
  }

  // Redux dispatches before React re-renders, so defer applying until after commit.
  let deferTimer = 0;
  function deferredApply() {
    if (deferTimer) clearTimeout(deferTimer);
    deferTimer = setTimeout(() => {
      deferTimer = 0;
      requestAnimationFrame(() => {
        measurePadding();
        apply();
      });
    }, 60);
  }

  addon.tab.redux.initialize();
  addon.tab.redux.addEventListener("statechanged", (e) => {
    const type = e.detail.action.type;
    if (type === "scratch-gui/StageSize/SET_STAGE_SIZE") {
      if (selfDispatch) return;
      // The built-in small/large buttons override our custom size.
      desiredW = null;
      restoreMode = null;
      removeVisualOverride();
      save();
      deferredApply();
    } else if (type === "scratch-gui/mode/SET_FULL_SCREEN") {
      deferredApply();
    }
  });

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    if (dragging || resizeRaf || desiredW === null) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      const clamped = clampWidth(desiredW);
      if (Math.abs(clamped - desiredW) > 0.5) {
        desiredW = clamped;
        apply();
      }
    });
  });

  addon.self.addEventListener("disabled", () => {
    endDrag();
    removeVisualOverride();
    restoreNativeMode();
    if (handle) handle.remove();
    syncRenderer();
    window.dispatchEvent(new Event("resize"));
  });
  addon.self.addEventListener("reenabled", () => {
    if (handle && column && flexWrapper && !handle.isConnected) {
      flexWrapper.insertBefore(handle, column);
    }
    measurePadding();
    apply();
  });

  while (true) {
    column = await addon.tab.waitForElement("[class*='gui_stage-and-target-wrapper_']", {
      markAsSeen: true,
      reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
    });
    flexWrapper = column.parentElement;
    stageWrapper = column.querySelector("[class*='stage-wrapper_stage-wrapper_']");
    stageEl = column.querySelector("[class*='stage_stage_']");
    canvas = stageEl && stageEl.querySelector("canvas");
    monitorScaler = column.querySelector("[class*='monitor-list_monitor-list-scaler']");
    if (!stageWrapper || !stageEl || !canvas) continue;

    resizeObserver = null;
    attachObserver();
    if (!handle) handle = makeHandle();
    if (!addon.self.disabled && !handle.isConnected) {
      flexWrapper.insertBefore(handle, column);
    }
    measurePadding();
    apply();
  }
}
