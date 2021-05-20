export default async function ({ addon, global, console }) {
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  const workspace = Blockly.getMainWorkspace();
  // Add sounds to the current workspace
  const pathToMedia = workspace.options.pathToMedia;
  ScratchBlocks.inject.loadSounds_(pathToMedia, workspace);
  // Add sounds to all future workspaces
  const originalInit = ScratchBlocks.init_;
  ScratchBlocks.init_ = function (...args) {
    if (!addon.self.disabled) {
      const wksp = args[0];
      wksp.options.hasSounds = true;
    }
    return originalInit.call(this, ...args);
  };
  // Dynamic enable/disable
  addon.self.addEventListener("disabled", () => {
    const workspace = Blockly.getMainWorkspace();
    if (workspace && workspace.audioManager_) {
      workspace.audioManager_.SOUNDS_ = {};
    }
  });
  addon.self.addEventListener("reenabled", () => {
    const workspace = Blockly.getMainWorkspace();
    if (workspace && workspace.audioManager_) {
      ScratchBlocks.inject.loadSounds_(pathToMedia, workspace);
    }
  });
}
