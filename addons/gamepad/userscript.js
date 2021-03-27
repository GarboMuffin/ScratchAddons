import GamepadLib from "./gamepadlib.js";

export default async function ({ addon, global, console, msg }) {
  const vm = addon.tab.traps.vm;

  // Wait for the project to finish loading
  await new Promise((resolve, reject) => {
    if (vm.editingTarget) return resolve();
    vm.runtime.once("PROJECT_LOADED", resolve);
  });

  const renderer = vm.runtime.renderer;

  const buttonGroup = document.createElement("div");
  buttonGroup.className = addon.tab.scratchClass("stage-header_stage-size-toggle-group");
  const buttonContainer = document.createElement("div");
  buttonContainer.className = addon.tab.scratchClass("button_outlined-button", "stage-header_stage-button");
  const buttonContent = document.createElement("div");
  buttonContent.className = addon.tab.scratchClass("button_content");
  const buttonImage = document.createElement("img");
  buttonImage.className = addon.tab.scratchClass("stage-header_stage-button-icon");
  buttonImage.draggable = false;
  buttonImage.src = addon.self.dir + "/gamepad.svg";
  buttonContent.appendChild(buttonImage);
  buttonContainer.appendChild(buttonContent);
  buttonGroup.appendChild(buttonContainer);
  buttonContainer.addEventListener("click", () => {
    const editor = gamepad.editor();
    const editorEl = editor.generateEditor();

    const close = () => {
      modalOverlay.remove();
      document.body.removeEventListener("click", handleClickOutside, true);
    };
    const handleClickOutside = (e) => {
      if (!modalContentContainer.contains(e.target)) {
        close();
      }
    };
    document.body.addEventListener("click", handleClickOutside, true);

    const modalOverlay = document.createElement("div");
    modalOverlay.className = addon.tab.scratchClass("modal_modal-overlay");
    const modalContentContainer = document.createElement("div");
    modalContentContainer.className = addon.tab.scratchClass("modal_modal-content", { others: "sa-gamepad-popup" });
    const modalHeaderContainer = document.createElement("div");
    modalHeaderContainer.className = addon.tab.scratchClass("modal_header");
    const modalHeaderText = document.createElement("div");
    modalHeaderText.className = addon.tab.scratchClass("modal_header-item", "modal_header-item-title");
    modalHeaderText.textContent = msg("settings");
    const modalContent = document.createElement("div");
    modalContent.className = "sa-gamepad-popup-content";
    modalContent.appendChild(editorEl);
    modalHeaderContainer.appendChild(modalHeaderText);
    modalContentContainer.appendChild(modalHeaderContainer);
    modalContentContainer.appendChild(modalContent);
    modalOverlay.appendChild(modalContentContainer);
    document.body.appendChild(modalOverlay);
  });

  const virtualCursorContainer = document.createElement("div");
  virtualCursorContainer.hidden = true;
  const virtualCursorImageContainer = document.createElement("div");
  virtualCursorImageContainer.className = "sa-gamepad-cursor-container";
  const virtualCursorImage = document.createElement("img");
  virtualCursorImage.className = "sa-gamepad-cursor-image";
  virtualCursorImage.src = addon.self.dir + "/inactive.png";
  virtualCursorImageContainer.appendChild(virtualCursorImage);
  virtualCursorContainer.appendChild(virtualCursorImageContainer);

  const virtualCursorSetVisible = (visible) => {
    virtualCursorContainer.hidden = !visible;
  };
  const virtualCursorSetDown = (down) => {
    virtualCursorSetVisible(true);
    if (down) {
      virtualCursorImage.src = addon.self.dir + "/active.png";
    } else {
      virtualCursorImage.src = addon.self.dir + "/inactive.png";
    }
  };
  const virtualCursorSetPosition = (x, y) => {
    virtualCursorSetVisible(true);
    const stageX = (width / 2) + x;
    const stageY = (height / 2) - y;
    virtualCursorImageContainer.style.transform = `translate(${stageX}px, ${stageY}px)`;
  };

  document.addEventListener("mousemove", () => {
    virtualCursorSetVisible(false);
  });

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
  const handleGamepadMouseDown = () => {
    virtualCursorSetDown(true);
    vm.postIOData("mouse", {
      isDown: true,
      canvasWidth: width,
      x: Math.max(0, Math.min(width, vm.runtime.ioDevices.mouse._clientX)),
      canvasHeight: height,
      y: vm.runtime.ioDevices.mouse._clientY,
    });
  };
  const handleGamepadMouseUp = () => {
    virtualCursorSetDown(false);
    vm.postIOData("mouse", {
      isDown: false,
    });
  };
  const handleGamepadMouseMove = (e) => {
    const { x, y } = e.detail;
    virtualCursorSetPosition(x, y);
    vm.postIOData("mouse", {
      canvasWidth: width,
      x: x + (width / 2),
      canvasHeight: height,
      y: (height / 2) - y,
    });
  };

  const width = renderer._xRight - renderer._xLeft;
  const height = renderer._yTop - renderer._yBottom;

  const gamepad = new GamepadLib();
  gamepad.virtualCursor.maxX = renderer._xRight;
  gamepad.virtualCursor.minX = renderer._xLeft;
  gamepad.virtualCursor.maxY = renderer._yTop;
  gamepad.virtualCursor.minY = renderer._yBottom;
  gamepad.addEventListener("keydown", handleGamepadButtonDown);
  gamepad.addEventListener("keyup", handleGamepadButtonUp);
  gamepad.addEventListener("mousedown", handleGamepadMouseDown);
  gamepad.addEventListener("mouseup", handleGamepadMouseUp);
  gamepad.addEventListener("mousemove", handleGamepadMouseMove);

  while (true) {
    const stage = await addon.tab.waitForElement("[class^='stage_stage_']", {
      markAsSeen: true,
    });
    stage.appendChild(virtualCursorContainer);

    const header = document.querySelector('[class*="stage-header_stage-size-row"]');
    header.insertBefore(buttonGroup, header.firstChild);
  }
}
