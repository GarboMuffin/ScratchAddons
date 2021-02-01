// Bits and pieces copied from https://github.com/greggman/twgl.js

/*
 * Copyright 2019 Gregg Tavares
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

const VecType = Float32Array;
const MatType = Float32Array;

const TEXTURE_2D = 0x0de1;
const TEXTURE_MIN_FILTER = 0x2801;
const TEXTURE_MAG_FILTER = 0x2800;

const twgl = {
  v3: {
    create(x, y, z) {
      const dst = new VecType(3);
      if (x) {
        dst[0] = x;
      }
      if (y) {
        dst[1] = y;
      }
      if (z) {
        dst[2] = z;
      }
      return dst;
    },
  },
  m4: {
    identity(dst) {
      dst = dst || new MatType(16);
      dst[0] = 1;
      dst[1] = 0;
      dst[2] = 0;
      dst[3] = 0;
      dst[4] = 0;
      dst[5] = 1;
      dst[6] = 0;
      dst[7] = 0;
      dst[8] = 0;
      dst[9] = 0;
      dst[10] = 1;
      dst[11] = 0;
      dst[12] = 0;
      dst[13] = 0;
      dst[14] = 0;
      dst[15] = 1;
    },
    ortho(left, right, bottom, top, near, far, dst) {
      dst = dst || new MatType(16);

      dst[0] = 2 / (right - left);
      dst[1] = 0;
      dst[2] = 0;
      dst[3] = 0;

      dst[4] = 0;
      dst[5] = 2 / (top - bottom);
      dst[6] = 0;
      dst[7] = 0;

      dst[8] = 0;
      dst[9] = 0;
      dst[10] = 2 / (near - far);
      dst[11] = 0;

      dst[12] = (right + left) / (left - right);
      dst[13] = (top + bottom) / (bottom - top);
      dst[14] = (far + near) / (near - far);
      dst[15] = 1;

      return dst;
    },
    scaling(v, dst) {
      dst = dst || new MatType(16);

      dst[0] = v[0];
      dst[1] = 0;
      dst[2] = 0;
      dst[3] = 0;
      dst[4] = 0;
      dst[5] = v[1];
      dst[6] = 0;
      dst[7] = 0;
      dst[8] = 0;
      dst[9] = 0;
      dst[10] = v[2];
      dst[11] = 0;
      dst[12] = 0;
      dst[13] = 0;
      dst[14] = 0;
      dst[15] = 1;

      return dst;
    },
  },
  drawBufferInfo(gl, bufferInfo, type, count, offset, instanceCount) {
    type = type === undefined ? TRIANGLES : type;
    const indices = bufferInfo.indices;
    const elementType = bufferInfo.elementType;
    const numElements = count === undefined ? bufferInfo.numElements : count;
    offset = offset === undefined ? 0 : offset;
    if (elementType || indices) {
      if (instanceCount !== undefined) {
        gl.drawElementsInstanced(
          type,
          numElements,
          elementType === undefined ? UNSIGNED_SHORT : bufferInfo.elementType,
          offset,
          instanceCount
        );
      } else {
        gl.drawElements(type, numElements, elementType === undefined ? UNSIGNED_SHORT : bufferInfo.elementType, offset);
      }
    } else {
      if (instanceCount !== undefined) {
        gl.drawArraysInstanced(type, offset, numElements, instanceCount);
      } else {
        gl.drawArrays(type, offset, numElements);
      }
    }
  },
  setAttributes(setters, buffers) {
    for (const name in buffers) {
      const setter = setters[name];
      if (setter) {
        setter(buffers[name]);
      }
    }
  },
  setBuffersAndAttributes(gl, programInfo, buffers) {
    if (buffers.vertexArrayObject) {
      gl.bindVertexArray(buffers.vertexArrayObject);
    } else {
      twgl.setAttributes(programInfo.attribSetters || programInfo, buffers.attribs);
      if (buffers.indices) {
        gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buffers.indices);
      }
    }
  },
  setTextureParameters(gl, tex, options) {
    const target = options.target || TEXTURE_2D;
    gl.bindTexture(target, tex);
    twgl.setTextureSamplerParameters(gl, target, gl.texParameteri, options);
  },
  setTextureSamplerParameters(gl, target, parameteriFn, options) {
    if (options.minMag) {
      parameteriFn.call(gl, target, TEXTURE_MIN_FILTER, options.minMag);
      parameteriFn.call(gl, target, TEXTURE_MAG_FILTER, options.minMag);
    }
    if (options.min) {
      parameteriFn.call(gl, target, TEXTURE_MIN_FILTER, options.min);
    }
    if (options.mag) {
      parameteriFn.call(gl, target, TEXTURE_MAG_FILTER, options.mag);
    }
    if (options.wrap) {
      parameteriFn.call(gl, target, TEXTURE_WRAP_S, options.wrap);
      parameteriFn.call(gl, target, TEXTURE_WRAP_T, options.wrap);
      if (target === TEXTURE_3D || helper.isSampler(gl, target)) {
        parameteriFn.call(gl, target, TEXTURE_WRAP_R, options.wrap);
      }
    }
    if (options.wrapR) {
      parameteriFn.call(gl, target, TEXTURE_WRAP_R, options.wrapR);
    }
    if (options.wrapS) {
      parameteriFn.call(gl, target, TEXTURE_WRAP_S, options.wrapS);
    }
    if (options.wrapT) {
      parameteriFn.call(gl, target, TEXTURE_WRAP_T, options.wrapT);
    }
    if (options.minLod) {
      parameteriFn.call(gl, target, TEXTURE_MIN_LOD, options.minLod);
    }
    if (options.maxLod) {
      parameteriFn.call(gl, target, TEXTURE_MAX_LOD, options.maxLod);
    }
    if (options.baseLevel) {
      parameteriFn.call(gl, target, TEXTURE_BASE_LEVEL, options.baseLevel);
    }
    if (options.maxLevel) {
      parameteriFn.call(gl, target, TEXTURE_MAX_LEVEL, options.maxLevel);
    }
  },
  setUniforms(setters, values) {
    const actualSetters = setters.uniformSetters || setters;
    const numArgs = arguments.length;
    for (let aNdx = 1; aNdx < numArgs; ++aNdx) {
      const values = arguments[aNdx];
      if (Array.isArray(values)) {
        const numValues = values.length;
        for (let ii = 0; ii < numValues; ++ii) {
          twgl.setUniforms(actualSetters, values[ii]);
        }
      } else {
        for (const name in values) {
          const setter = actualSetters[name];
          if (setter) {
            setter(values[name]);
          }
        }
      }
    }
  },
};

export default twgl;
