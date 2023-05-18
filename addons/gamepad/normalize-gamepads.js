/**
 * @param {Gamepad} gamepad
 * @param {string} vendor USB hex vendor code as a string
 * @param {string} product USB hex product code as a string
 * @returns {boolean} true if the gamepad seems to match the vendor and product codes
 */
const matchesUSB = (gamepad, vendor, product) => {
  // Example values for `gamepad.id` include:
  // Chrome on Linux:
  //  - Microsoft Controller (STANDARD GAMEPAD Vendor: 045e Product: 02ea)
  //  - USB,2-axis 8-button gamepad   (STANDARD GAMEPAD Vendor: 0583 Product: 2060)
  // Firefox on Linux:
  //  - 045e-02ea-Microsoft X-Box One S pad
  //  - 0583-2060-USB,2-axis 8-button gamepad
  // GNOME Web on Linux:
  //  - Microsoft X-Box One S pad
  //  - USB,2-axis 8-button gamepad
  // Firefox on Windows:
  //  - xinput
  //  - 0583-2060-USB,2-axis 8-button gamepad
  // Chrome on Windows:
  //  - Xbox 360 Controller (XInput STANDARD GAMEPAD)
  //  - USB,2-axis 8-button gamepad
  // This logic is not perfect, but good enough for what we need.
  return gamepad.id.includes(vendor) && gamepad.id.includes(product);
};

/**
 * @param {number} value
 * @returns {GamepadButton}
 */
const createGamepadButton = (value) => ({
  pressed: value >= 0.1,
  touched: false,
  value,
});

/**
 * @param {Gamepad} gamepad
 * @returns {Gamepad} something similar to a Gamepad
 */
export const normalizeGamepad = (gamepad) => {
  if (!gamepad) return gamepad;

  let newButtons;
  let newAxes;

  // Firefox on Linux has a broken gamepad API.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1643358
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1643835
  // On my Xbox controller (Vendor 045e Product 02ea):
  //  - Second joystick has left/right on 3, up/down on 4
  //  - Left trigger is on axis 2. Right trigger is on axis 5. For both of these -1 means released
  //  - Menu button is on 7, change window button is on 6
  //  - Pressing first joystick is button 9, pressing second joystick is button 10
  //  - D-pad left/right is on axis 6, up/down on axis 7
  // On my classic-style controller (Vendor 0583 Product 2060):
  //  - X/Y and A/B are "backwards" due to Nintendo layout. In Chrome the physical location of the buttons
  //    are used while in Firefox the labels by the buttons are used. Not within scope to fix for now
  //  - Select is button 6 in Firefox, 8 in Chrome
  //  - Start is button 7 in Firefox, 9 in Chrome
  //  - D-pad left/right is on axis 0, up/down on axis 1 (2 total axes)
  if (
    navigator.userAgent.includes("Firefox") &&
    navigator.userAgent.includes("Linux") &&
    (gamepad.axes.length === 8 || gamepad.axes.length === 2)
  ) {
    newButtons = [
      gamepad.buttons[0], // A
      gamepad.buttons[1], // B
      gamepad.buttons[2], // X
      gamepad.buttons[3], // Y
      gamepad.buttons[4], // Left bumper
      gamepad.buttons[5], // Right bumper
      createGamepadButton((gamepad.axes[2] + 1) / 2), // Left trigger
      createGamepadButton((gamepad.axes[5] + 1) / 2), // Right trigger
      gamepad.buttons[6], // Change window or select
      gamepad.buttons[7], // Menu or start
      gamepad.buttons[9], // Left joystick pressed
      gamepad.buttons[10], // Right joystick pressed
      createGamepadButton(gamepad.axes[gamepad.axes.length - 1] < 0 ? 1 : 0), // D-pad up
      createGamepadButton(gamepad.axes[gamepad.axes.length - 1] > 0 ? 1 : 0), // D-pad down
      createGamepadButton(gamepad.axes[gamepad.axes.length - 2] < 0 ? 1 : 0), // D-pad left
      createGamepadButton(gamepad.axes[gamepad.axes.length - 2] > 0 ? 1 : 0), // D-pad right
    ];
    newAxes = [gamepad.axes[0], gamepad.axes[1], gamepad.axes[3], gamepad.axes[4]];
  }

  // MaxFire Blaze2 - Vendor 0e8f Product 0003
  // Second joystick has axis 2 for left/right and 5 for up/down
  // There are also 10 axes for no apparent reason. Most axes are invalid and either report
  // a fixed value or nonsense far outside of the [-1, 1] range they should.
  // Reported in https://discord.com/channels/806602307750985799/806602307750985803/1108633733420023848
  if (matchesUSB(gamepad, "0e8f", "0003") && gamepad.axes.length === 10) {
    newAxes = [gamepad.axes[0], gamepad.axes[1], gamepad.axes[2], gamepad.axes[5]];
  }

  if (newButtons || newAxes) {
    if (newButtons) {
      newButtons = newButtons.map((button) => button || createGamepadButton(0));
    }
    if (newAxes) {
      newAxes = newAxes.map((axis) => axis || 0);
    }
    const cloned = {
      id: gamepad.id,
      index: gamepad.index,
      buttons: newButtons || gamepad.buttons,
      axes: newAxes || gamepad.axes,
      connected: gamepad.connected,
      mapping: gamepad.connected,
      timestamp: gamepad.connected,
    };
    return cloned;
  }

  return gamepad;
};

/**
 * @returns {Array<Gamepad|null>}
 */
export const getNormalizedGamepads = () => navigator.getGamepads().map(normalizeGamepad);
