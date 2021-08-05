export default async function ({ addon, console }) {
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  const originalCreateVariable = ScratchBlocks.Variables.createVariable;
  ScratchBlocks.Variables.createVariable = function (workspace, callback, type) {
    return originalCreateVariable(workspace, (id) => {
      // Undo https://github.com/LLK/scratch-blocks/blob/b67025bd4370d094b836839ba6156804b1e5789c/core/variables.js#L329-L333
      const flyout = workspace.isFlyout ? workspace : workspace.getFlyout();
      if (flyout) {
        flyout.setCheckboxState(id, false);
      }
      if (callback) {
        callback(id);
      }
    }, type);
  };
}
