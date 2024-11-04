import * as sharedModule from "./module.js";

/** @param {UserscriptUtilities} param0 */
export default async function ({ addon, console }) {
  const update = () => {
    sharedModule.setDuplication(!addon.self.disabled);
  };
  addon.self.addEventListener("disabled", update);
  addon.self.addEventListener("reenabled", update);
  update();
  sharedModule.load(addon);
}
