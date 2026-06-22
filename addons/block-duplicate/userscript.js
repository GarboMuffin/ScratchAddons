import * as sharedModule from "./module.js";

export default async function ({ addon, console }) {
  const update = () => {
    sharedModule.setDuplication(!addon.self.disabled);
    sharedModule.setVariableReporter(!addon.self.disabled && addon.settings.get("variableReporter"));
  };
  addon.self.addEventListener("disabled", update);
  addon.self.addEventListener("reenabled", update);
  addon.settings.addEventListener("change", update);
  update();
  sharedModule.load(addon);
}
