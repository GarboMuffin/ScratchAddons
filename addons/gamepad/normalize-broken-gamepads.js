/**
 * @param {Gamepad} gamepad
 * @param {string} vendor USB hex vendor code as a string
 * @param {string} product USB hex product code as a string
 * @returns {boolean} true if the gamepad seems to match the vendor and product codes
 */
const matchesUSB = (gamepad, vendor, product) => {
  // Possible values for gamepad.id include:
  // Chrome on Linux:
  //  - Microsoft Controller (STANDARD GAMEPAD Vendor: 045e Product: 02ea)
  //  - USB,2-axis 8-button gamepad   (STANDARD GAMEPAD Vendor: 0583 Product: 2060)
  // Firefox on Linux:
  //  - 045e-02ea-Microsoft X-Box One S pad
  //  - 0583-2060-USB,2-axis 8-button gamepad
  // GNOME Web on Linux:
  //  - Microsoft X-Box One S pad
  //  - USB,2-axis 8-button gamepad
  return gamepad.id.includes(vendor) && gamepad.id.includes(product);
};

/**
 * @param {number} value
 * @returns {GamepadButton}
 */
const createGamepadButton = (value) => ({
  pressed: value >= 0.1,
  touched: false,
  value
});

/**
 * @param {Gamepad} gamepad
 * @returns {Gamepad} something similar to a Gamepad
 */
export const normalizeGamepad = (gamepad) => {
  if (!gamepad) return gamepad;

  gamepad = {
    id: gamepad.id,
    index: gamepad.index,
    buttons: gamepad.buttons,
    axes: gamepad.axes,
    connected: gamepad.connected,
    mapping: gamepad.connected,
    timestamp: gamepad.connected
  };

  // Firefox on Linux returns broken gamepads.
  // I have verified this on my Xbox controller (Vendor 045e Product 02ea). Based on upstream
  // bugs I expect this to apply to other controllers too:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1643358
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1643835
  // Second joystick has left/right on 3, up/down on 4.
  // Left trigger is on axis 2. Right trigger is on axis 5. For both of these -1 means released.
  // Menu button is on 7, change window button is on 6.
  // Pressing first joystick is button 9, pressing second joystick is button 10.
  // D-pad left/right is on axis 6, up/down on axis 7.
  if (navigator.userAgent.includes('Firefox') && navigator.userAgent.includes('Linux') && gamepad.axes.length === 8) {
    gamepad.buttons = [
      gamepad.buttons[0], // A
      gamepad.buttons[1], // B
      gamepad.buttons[2], // X
      gamepad.buttons[3], // Y
      gamepad.buttons[4], // Left bumper
      gamepad.buttons[5], // Right bumper
      createGamepadButton((gamepad.axes[2] + 1) / 2), // Left trigger
      createGamepadButton((gamepad.axes[5] + 1) / 2), // Right trigger
      gamepad.buttons[6], // Change window
      gamepad.buttons[7], // Menu
      gamepad.buttons[9], // Left joystick pressed
      gamepad.buttons[10], // Right joystick pressed
      createGamepadButton(gamepad.axes[7] < 0 ? 1 : 0), // D-pad up
      createGamepadButton(gamepad.axes[7] > 0 ? 1 : 0), // D-pad down
      createGamepadButton(gamepad.axes[6] < 0 ? 1 : 0), // D-pad left
      createGamepadButton(gamepad.axes[6] > 0 ? 1 : 0), // D-pad right
    ];
    gamepad.axes = [
      gamepad.axes[0],
      gamepad.axes[1],
      gamepad.axes[3],
      gamepad.axes[4]
    ];
  }

  // MaxFire Blaze2 - Vendor 0e8f Product 0003
  // Second joystick has axis 2 for left/right and 5 for up/down
  // There are also 10 axes for no apparent reason. Most axes are invalid and either report
  // a fixed value or nonsense far outside of the [-1, 1] range they should.
  // Reported in https://discord.com/channels/806602307750985799/806602307750985803/1108633733420023848
  if (matchesUSB(gamepad, '0e8f', '0003') && gamepad.axes.length === 10) {
    gamepad.axes = [
      gamepad.axes[0],
      gamepad.axes[1],
      gamepad.axes[2],
      gamepad.axes[5]
    ];
  }

  return gamepad;
};

export const getNormalizedGamepads = () => navigator.getGamepads().map(normalizeGamepad);
