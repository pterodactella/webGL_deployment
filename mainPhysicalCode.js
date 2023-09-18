import GLProgram from './helper/glProgram.js';
import Pointer from './helper/pointer.js';
import PointerHandler from './helper/events.js';
const canvas = document.getElementById('canvas');
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
const colorPicker = document.getElementById('colorPicker');


// Setting up parametric variables for the simulation
let textureResolutionDecrease = 0.0000000001;
let densityDiffusionRate = 1;
let velocityDecayRate = 0.99;
let pressureCalculationSteps = 44;
let drawEffectRadius = 0.0005;

let pointers = [];
let textureWidth;
let textureHeight;
let density;
let velocity;
let divergence;
let pressure;
const { gl, ext } = initWebGL(canvas);

function initWebGL(canvas) {
  const contextParams = { alpha: false, depth: false, stencil: false, antialias: false };
  let gl =
    canvas.getContext('webgl2', contextParams) ||
    canvas.getContext('webgl', contextParams) ||
    canvas.getContext('experimental-webgl', contextParams);
  const isWebGL2 = Boolean(gl && gl instanceof WebGL2RenderingContext);

  if (!gl) {
    console.error('WebGL is not supported by your browser.');
    return;
  }

  if (isWebGL2) {
    if (!gl.getExtension('EXT_color_buffer_float')) {
      console.warn('EXT_color_buffer_float not supported');
    }
    if (!gl.getExtension('OES_texture_float_linear')) {
      console.warn('OES_texture_float_linear not supported');
    }
  } else {
    // console.log('WebGL2 not available -> switching to standard textures');
    if (!gl.getExtension('OES_texture_half_float')) {
      console.warn('OES_texture_half_float not supported');
    }
    if (!gl.getExtension('OES_texture_half_float_linear')) {
      console.warn('OES_texture_half_float_linear not supported');
    }
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : gl.HALF_FLOAT_OES;

  return {
    gl,
    ext: {
      formatRGBA: findSupportedFormat(gl, isWebGL2 ? gl.RGBA16F : gl.RGBA, gl.RGBA, halfFloatTexType),
      formatRG: findSupportedFormat(gl, isWebGL2 ? gl.RG16F : gl.RGBA, isWebGL2 ? gl.RG : gl.RGBA, halfFloatTexType),
      formatR: findSupportedFormat(gl, isWebGL2 ? gl.R16F : gl.RGBA, isWebGL2 ? gl.RED : gl.RGBA, halfFloatTexType),
      halfFloatTexType,
    },
  };
}

function findSupportedFormat(gl, internalFormat, format, type) {
  if (!validateRenderTextureFormat(gl, internalFormat, format, type)) {
    if (internalFormat === gl.R16F) {
      return findSupportedFormat(gl, gl.RG16F, gl.RG, type);
    } else if (internalFormat === gl.RG16F) {
      return findSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
    } else {
      return null;
    }
  }

  return { internalFormat, format };
}

function validateRenderTextureFormat(gl, internalFormat, format, type) {
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

  let fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE;
}

pointers.push(new Pointer());

const compileShader = (type, source) => {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    let info = gl.getShaderInfoLog(shader);
    throw new Error('Could not compile WebGL program.\n\n' + info);
  }
  return shader;
};

const vertexShader = compileShader(gl.VERTEX_SHADER, document.getElementById('vertexShader').textContent);
const colorShader = compileShader(gl.FRAGMENT_SHADER, document.getElementById('colorShader').textContent);
const externalForceShader = compileShader(gl.FRAGMENT_SHADER, document.getElementById('externalForceShader').textContent);
const advectionShader = compileShader(gl.FRAGMENT_SHADER, document.getElementById('advectionShader').textContent);
const divergenceShader = compileShader(gl.FRAGMENT_SHADER, document.getElementById('divergenceShader').textContent);
const pressureShader = compileShader(gl.FRAGMENT_SHADER, document.getElementById('pressureShader').textContent);
const gradientShader = compileShader(gl.FRAGMENT_SHADER, document.getElementById('gradientShader').textContent);

const displayProgram = new GLProgram(gl, vertexShader, colorShader);
const externalForceProgram = new GLProgram(gl, vertexShader, externalForceShader);
const advectionProgram = new GLProgram(gl, vertexShader, advectionShader);
const divergenceProgram = new GLProgram(gl, vertexShader, divergenceShader);
const pressureProgram = new GLProgram(gl, vertexShader, pressureShader);
const gradienSubtractProgram = new GLProgram(gl, vertexShader, gradientShader);

function initFramebuffers() {
  textureWidth = gl.drawingBufferWidth >> textureResolutionDecrease;
  textureHeight = gl.drawingBufferHeight >> textureResolutionDecrease;

  const texType = ext.halfFloatTexType;

  const texParams = [
    { id: 2, format: ext.formatRGBA, param: gl.LINEAR, isDouble: true },
    { id: 0, format: ext.formatRG, param: gl.LINEAR, isDouble: true },
    { id: 4, format: ext.formatR, param: gl.NEAREST, isDouble: false },
    { id: 6, format: ext.formatR, param: gl.NEAREST, isDouble: true },
  ];

  texParams.forEach(({ id, format, param, isDouble }) => {
    const result = createFramebufferObject(id, textureWidth, textureHeight, format.internalFormat, format.format, texType, param, isDouble);

    switch(id) {
      case 2: density = result; break;
      case 0: velocity = result; break;
      case 4: divergence = result; break;
      case 6: pressure = result; break;
    }
  });
}

function createFramebufferObject(texId, w, h, internalFormat, format, type, param, isDouble) {
  const createFBO = (id) => {
    gl.activeTexture(gl.TEXTURE0 + id);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return [texture, fbo, id];
  }

  if (!isDouble) {
    return createFBO(texId);
  }

  const fbo1 = createFBO(texId);
  const fbo2 = createFBO(texId + 1);

  return {
    read: fbo1,
    write: fbo2,
    swap() {
      [this.read, this.write] = [this.write, this.read];
    },
  };
}


const createBuffer = (bufferType, data, size, arrayType, usage) => {
  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, new arrayType(data), usage);
  return buffer;
};

const enableVertexAttrib = (index, size, type, normalize, stride, offset) => {
  gl.vertexAttribPointer(index, size, type, normalize, stride, offset);
  gl.enableVertexAttribArray(index);
};

const drawBuffer = (() => {
  createBuffer(gl.ARRAY_BUFFER, [-1, -1, -1, 1, 1, 1, 1, -1], 2, Float32Array, gl.STATIC_DRAW);
  createBuffer(gl.ELEMENT_ARRAY_BUFFER, [0, 1, 2, 0, 2, 3], 2, Uint16Array, gl.STATIC_DRAW);

  enableVertexAttrib(0, 2, gl.FLOAT, false, 0, 0);

  return (destination) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
})();


initFramebuffers();
let lastTime = Date.now();
update();



function update() {
  const dt = Math.min((Date.now() - lastTime) / 1000, 0.016);
  lastTime = Date.now();

  gl.viewport(0, 0, textureWidth, textureHeight);

  advectionProgram.bind();
  gl.uniform2f(advectionProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);
  gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read[2]);
  gl.uniform1f(advectionProgram.uniforms.dt, dt);
  gl.uniform1f(advectionProgram.uniforms.dissipation, velocityDecayRate);
  drawBuffer(velocity.write[1]);
  velocity.swap();

  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);
  gl.uniform1i(advectionProgram.uniforms.uSource, density.read[2]);
  gl.uniform1f(advectionProgram.uniforms.dissipation, densityDiffusionRate);
  drawBuffer(density.write[1]);
  density.swap();

  // for (let i = 0; i < pointers.length; i++) {
  //   const pointer = pointers[i];
  //   let newColor = [255,160,122];
  //   pointer.color = newColor.map((c) => c / 255);
  //   if (pointer.moved) {
  //     draw(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color);
  //     pointer.moved = false;
  //   }
  // }

  for (let i = 0; i < pointers.length; i++) {
    const pointer = pointers[i];
    
    // Read the color from the color picker and convert it to an array of RGB values
    let hexColor = colorPicker.value;
    let newColor = [
      parseInt(hexColor.substr(1, 2), 16),
      parseInt(hexColor.substr(3, 2), 16),
      parseInt(hexColor.substr(5, 2), 16)
    ];
    
    pointer.color = newColor.map((c) => c / 255);
    
    if (pointer.moved) {
      draw(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color);
      pointer.moved = false;
    }
  }
  

  divergenceProgram.bind();
  gl.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
  gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read[2]);
  drawBuffer(divergence[1]);

  pressureProgram.bind();
  gl.uniform2f(pressureProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
  gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence[2]);
  let pressureTexId = pressure.read[2];
  gl.uniform1i(pressureProgram.uniforms.uPressure, pressureTexId);
  gl.activeTexture(gl.TEXTURE0 + pressureTexId);
  for (let i = 0; i < pressureCalculationSteps; i++) {
    gl.bindTexture(gl.TEXTURE_2D, pressure.read[0]);
    drawBuffer(pressure.write[1]);
    pressure.swap();
  }

  gradienSubtractProgram.bind();
  gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
  gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read[2]);
  gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read[2]);
  drawBuffer(velocity.write[1]);
  velocity.swap();

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  displayProgram.bind();
  gl.uniform1i(displayProgram.uniforms.uTexture, density.read[2]);
  drawBuffer(null);

  requestAnimationFrame(update);
}

function draw(x, y, dx, dy, color) {
  const forceUniforms = {
    uTarget: velocity.read[2],
    aspectRatio: canvas.width / canvas.height,
    point: [x / canvas.width, 1.0 - y / canvas.height],
    color: [dx, -dy, 1.0],
    radius: drawEffectRadius
  };

  applyForce(forceUniforms, velocity);

  forceUniforms.uTarget = density.read[2];
  forceUniforms.color = color;
  
  applyForce(forceUniforms, density);
}

function applyForce(forceUniforms, target) {
  externalForceProgram.bind();

  gl.uniform1i(externalForceProgram.uniforms.uTarget, forceUniforms.uTarget);
  gl.uniform1f(externalForceProgram.uniforms.aspectRatio, forceUniforms.aspectRatio);
  gl.uniform2f(externalForceProgram.uniforms.point, forceUniforms.point[0], forceUniforms.point[1]);
  gl.uniform3f(externalForceProgram.uniforms.color, forceUniforms.color[0], forceUniforms.color[1], forceUniforms.color[2]);
  gl.uniform1f(externalForceProgram.uniforms.radius, forceUniforms.radius);
  
  drawBuffer(target.write[1]);
  target.swap();
}
new PointerHandler(canvas, pointers);