/**
 * 轻量 WebGL 雾幕层：覆盖在 Cesium 画布上，在阴雨和浓雾天气时提供
 * 飘动的柔和雾团。纯视觉呈现，不改变气动力、能见度或触地判定。
 */
export interface FogLayerOptions {
  /** 雾幕不透明度，0 表示隐藏。 */
  opacity: number
  /** 雾团漂移速度倍率。 */
  speed: number
  /** 雾团尺度倍率，越大雾团越细碎。 */
  scale: number
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_opacity;
uniform float u_scale;

// 无纹理哈希噪声：确定性、无需外部资源即可生成柔和雾团。
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// 叠加不同频率的噪声层，得到有层次的雾团而不是均匀灰雾。
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 4; i++) {
    value += noise(p) * amplitude;
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  // 保持屏幕比例，避免雾团被拉伸成椭圆。
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = uv * u_scale;
  float drift = u_time * u_speed;
  float layers = fbm(p + vec2(drift * 0.06, drift * 0.03));
  layers += fbm(p * 1.7 - vec2(drift * 0.04, drift * 0.05)) * 0.5;
  // 柔和对比映射，保留中间层次；边缘略密，模拟贴近镜头的雾气。
  float density = smoothstep(0.18, 1.1, layers);
  vec2 center = uv - vec2(0.5);
  density *= 1.0 - 0.35 * dot(center, center);
  gl_FragColor = vec4(0.82, 0.85, 0.88, density * u_opacity);
}
`

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader => {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`雾幕着色器编译失败：${message}`)
  }
  return shader
}

export class FogLayer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private active = false
  private animationId = 0
  private startTime = 0
  private options: FogLayerOptions = { opacity: 0, speed: 0.3, scale: 3 }

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'weather-fog-layer'
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'none',
    })
    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    })
  }

  private initialize() {
    const gl = this.gl
    if (!gl || this.program) return
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`雾幕着色器链接失败：${gl.getProgramInfoLog(program)}`)
    }
    gl.useProgram(program)
    this.program = program
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    // 两个三角形覆盖整个裁剪空间。
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )
    const location = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private resize() {
    const gl = this.gl
    if (!gl) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio))
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      gl.viewport(0, 0, width, height)
    }
  }

  private render = (now: number) => {
    if (!this.active) return
    const gl = this.gl
    if (!gl || !this.program) return
    this.resize()
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(
      gl.getUniformLocation(this.program, 'u_resolution'),
      this.canvas.width,
      this.canvas.height
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_time'),
      (now - this.startTime) / 1000
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_speed'),
      this.options.speed
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_opacity'),
      this.options.opacity
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_scale'),
      this.options.scale
    )
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    this.animationId = requestAnimationFrame(this.render)
  }

  get element() {
    return this.canvas
  }

  setOptions(options: Partial<FogLayerOptions>) {
    this.options = { ...this.options, ...options }
    if (!(this.options.opacity > 0)) {
      this.hide()
      return
    }
    try {
      this.initialize()
    } catch (error) {
      console.warn('雾幕效果初始化失败，已跳过浓雾渲染。', error)
      this.hide()
      return
    }
    this.canvas.style.display = 'block'
    if (!this.active) {
      this.active = true
      this.startTime = performance.now()
      this.animationId = requestAnimationFrame(this.render)
    }
  }

  hide() {
    this.active = false
    cancelAnimationFrame(this.animationId)
    this.canvas.style.display = 'none'
    const gl = this.gl
    if (gl) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }

  destroy() {
    this.hide()
    const gl = this.gl
    if (!gl) return
    if (this.program) gl.deleteProgram(this.program)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    this.program = null
    this.buffer = null
    // 主动释放 WebGL 上下文，避免反复切换天气时累积。
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.gl = null
    this.canvas.remove()
  }
}
