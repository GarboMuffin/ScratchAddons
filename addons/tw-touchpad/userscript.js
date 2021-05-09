import TouchLib from "./touchlib.js";

export default async function ({ addon, global, console, msg }) {
  const vm = addon.tab.traps.vm;

  const handleGamepadButtonDown = (e) => {
    const key = e.detail;
    vm.postIOData("keyboard", {
      key: key,
      isDown: true,
    });
  };
  const handleGamepadButtonUp = (e) => {
    const key = e.detail;
    vm.postIOData("keyboard", {
      key: key,
      isDown: false,
    });
  };

  const touchLib = new TouchLib();
  touchLib.addEventListener("keydown", handleGamepadButtonDown);
  touchLib.addEventListener("keyup", handleGamepadButtonUp);
}
