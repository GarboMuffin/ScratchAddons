import twgl from "./twgl-very-minimal.js";

export default async function ({ addon, global, console }) {
  const vm = addon.tab.traps.vm;
  const renderer = vm.runtime.renderer;
  const gl = renderer.gl;

  let renderQuality = renderer.canvas.width / renderer._nativeSize[0];
  let penSkin;

  // Create shader used to resize pen skin.
  const drawTextureShader = renderer._shaderManager.getShader(
    /* ShaderManager.DRAW_MODE.default */ "default",
    /* NO_EFFECTS */ 0
  );
  const enterDrawTexture = () => {
    penSkin._enterUsePenBuffer();
    gl.viewport(0, 0, penSkin._size[0], penSkin._size[1]);
    gl.useProgram(drawTextureShader.program);
    twgl.setBuffersAndAttributes(gl, drawTextureShader, renderer._bufferInfo);
  };
  const exitDrawTexture = () => {
    penSkin._exitUsePenBuffer();
  };
  const drawPenTexture = (texture) => {
    renderer.enterDrawRegion(drawTextureRegionId);
    const width = penSkin._size[0];
    const height = penSkin._size[1];
    const uniforms = {
      u_skin: texture,
      u_projectionMatrix: twgl.m4.ortho(width / 2, width / -2, height / -2, height / 2, -1, 1, twgl.m4.identity()),
      u_modelMatrix: twgl.m4.scaling(twgl.v3.create(width, height, 0), twgl.m4.identity()),
    };
    twgl.setTextureParameters(gl, texture, {
      min: gl.LINEAR,
      mag: gl.NEAREST,
    });
    twgl.setUniforms(drawTextureShader, uniforms);
    twgl.drawBufferInfo(gl, renderer._bufferInfo, gl.TRIANGLES);
  };
  const drawTextureRegionId = {
    enter: () => enterDrawTexture(),
    exit: () => exitDrawTexture(),
  };

  const foundPenSkin = (_penSkin) => {
    if (penSkin) {
      // Should never happen
      return;
    }
    penSkin = _penSkin;

    // Scale pen line draws
    const originalDrawLineOnBuffer = penSkin._drawLineOnBuffer;
    penSkin._drawLineOnBuffer = function (attrs, x0, y0, x1, y1) {
      const diameter = attrs.diameter;
      attrs.diameter = diameter * renderQuality;
      originalDrawLineOnBuffer.call(
        penSkin,
        attrs,
        x0 * renderQuality,
        y0 * renderQuality,
        x1 * renderQuality,
        y1 * renderQuality
      );
      attrs.diameter = diameter;
    };

    // Always use native size for positioning
    Object.defineProperty(penSkin, "size", {
      get() {
        return renderer._nativeSize;
      },
    });

    updatePenSkinQuality();
  };

  const updatePenSkinQuality = () => {
    // Scratch's logic that attempts to resize the pen skin doesn't actually work.
    // So, we'll trick it into thinking it has to create a new texture and manually draw the old version ourselves.
    // TODO don't leak framebuffer
    penSkin._framebuffer = null;
    const oldTexture = penSkin._texture;
    penSkin._setCanvasSize([renderer._nativeSize[0] * renderQuality, renderer._nativeSize[1] * renderQuality]);
    if (oldTexture) {
      drawPenTexture(oldTexture);
    }
    penSkin._rotationCenter[0] = renderer._nativeSize[0] / 2;
    penSkin._rotationCenter[1] = renderer._nativeSize[1] / 2;
  };

  // Hook resize
  const originalResize = renderer.resize;
  renderer.resize = function (width, height) {
    originalResize.call(this, width, height);
    renderQuality = width / this._nativeSize[0];
    if (penSkin) {
      updatePenSkinQuality();
    }
  };

  // Scale stamps
  const originalTouchingBounds = renderer._touchingBounds;
  const scaledTouchingBounds = function (skinId) {
    const bounds = originalTouchingBounds.call(this, skinId);
    bounds.left *= renderQuality;
    bounds.right *= renderQuality;
    bounds.top *= renderQuality;
    bounds.bottom *= renderQuality;
    return bounds;
  };
  const originalPenStamp = renderer.penStamp;
  renderer.penStamp = function (penSkinId, stampId) {
    this._touchingBounds = scaledTouchingBounds;
    originalPenStamp.call(this, penSkinId, stampId);
    this._touchingBounds = originalTouchingBounds;
  };

  // Hook creating new pen skins.
  const originalCreatePenSkin = renderer.createPenSkin;
  renderer.createPenSkin = function () {
    const skinId = originalCreatePenSkin.call(this);
    const skin = this._allSkins[skinId];
    foundPenSkin(skin);
    return skinId;
  };

  // If we run really late, maybe the pen skin was already created.
  for (const skin of renderer._allSkins) {
    if (skin && skin._usePenBufferDrawRegionId) {
      foundPenSkin(skin);
      break;
    }
  }
}
