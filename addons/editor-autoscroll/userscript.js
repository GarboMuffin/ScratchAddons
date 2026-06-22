export default async function ({ addon, console }) {
  const Blockly = await addon.tab.traps.getBlockly();

  // This relies on the modern Blockly drag API (gesture.getCurrentDragger,
  // Dragger#startLoc, workspace.scroll). Bail out on the legacy Blockly.
  if (!Blockly || !Blockly.dragging || !Blockly.BlockSvg) return;

  let rafId = null;
  let lastEvent = null;

  const schedule = () => {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  };

  function tick() {
    rafId = null;
    if (addon.self.disabled) return;
    if (addon.tab.editorMode !== "editor") return;

    let workspace;
    try {
      workspace = addon.tab.traps.getWorkspace();
    } catch (e) {
      return;
    }
    if (!workspace) return;

    const gesture = workspace.currentGesture_;
    if (!gesture || typeof gesture.isDragging !== "function" || !gesture.isDragging()) return;

    const dragger = gesture.getCurrentDragger && gesture.getCurrentDragger();
    // Only autoscroll while dragging an actual block/script (not when panning
    // the workspace or dragging a comment).
    if (!dragger || !(dragger.draggable instanceof Blockly.BlockSvg)) return;

    // A block drag is in progress; keep ticking even if the pointer is held
    // still at an edge (no pointermove fires in that case).
    schedule();

    if (!lastEvent) return;

    // Visible workspace viewport in client coordinates. The absolute metrics
    // exclude the block palette (flyout) so we never scroll while hovering it.
    const svgRect = workspace.getParentSvg().getBoundingClientRect();
    const metricsManager = workspace.getMetricsManager();
    const abs = metricsManager.getAbsoluteMetrics();
    const view = metricsManager.getViewMetrics();
    const left = svgRect.left + abs.left;
    const top = svgRect.top + abs.top;
    const right = left + view.width;
    const bottom = top + view.height;

    const x = lastEvent.clientX;
    const y = lastEvent.clientY;

    // Don't autoscroll once the block leaves the workspace (delete zone,
    // backpack, another sprite, etc.) — let Scratch handle that drop.
    if (x < left || x > right || y < top || y > bottom) return;

    const margin = addon.settings.get("activationMargin");
    const maxSpeed = addon.settings.get("scrollSpeed");
    const speedFor = (dist) => Math.min(1, Math.max(0, (margin - dist) / margin)) * maxSpeed;

    let dsx = 0;
    let dsy = 0;
    if (x < left + margin)
      dsx = speedFor(x - left); // near left edge → reveal content to the left
    else if (x > right - margin) dsx = -speedFor(right - x); // near right edge → reveal content to the right
    if (y < top + margin) dsy = speedFor(y - top);
    else if (y > bottom - margin) dsy = -speedFor(bottom - y);

    if (dsx === 0 && dsy === 0) return;

    const scale = workspace.scale || 1;
    workspace.scroll(workspace.scrollX + dsx, workspace.scrollY + dsy);
    // Shift the drag's reference point so the dragged block stays under the
    // pointer instead of sliding away with the scrolling canvas.
    dragger.startLoc.x -= dsx / scale;
    dragger.startLoc.y -= dsy / scale;
    // Re-run the drag so the block re-renders at the new location and its
    // connection candidates / insertion markers update.
    gesture.handleMove(lastEvent);
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      lastEvent = e;
      schedule();
    },
    true
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      lastEvent = e;
      // Only bother while a button is held — a drag always holds the pointer.
      if (e.buttons) schedule();
    },
    true
  );
}
