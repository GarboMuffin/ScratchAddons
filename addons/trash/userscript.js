export default async function ({ addon, global, console }) {
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  // Add trash to current workspace
  const workspace = Blockly.getMainWorkspace();
  const bottom = workspace.addTrashcan_(ScratchBlocks.Scrollbar.scrollbarThickness);
  workspace.zoomControls_.init(bottom);
  workspace.zoomControls_.position();
  // Add trash to all future workspaces
  const originalInit = ScratchBlocks.init_;
  ScratchBlocks.init_ = function (...args) {
    const wksp = args[0];
    wksp.options.trash = true;
    return originalInit.call(this, ...args);
  };
}
