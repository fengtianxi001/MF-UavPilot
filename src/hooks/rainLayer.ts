/**
 * 轻量 WebGL 雨幕层：覆盖在 Cesium 画布上，只在降雨/雷雨时启用。
 * 纯渲染效果，不参与气动力、能见度或触地判定。
 */
export interface RainLayerOptions {
  /** 雨滴数量，0 表示隐藏。 */
  count: number
  /** 下落速度倍率。 */
  speed: number
  /** 雨滴不透明度。 */
  opacity: number
}

const VERTEX_SHADER = `
attribute vec2 a_seed;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_opacity;
uniform float u_pixelRatio;
varying float v_alpha;
void main() {
  // seed.x 横向固定，seed.y 决定初始纵向相位，避免每帧随机闪烁。
  float fall = fract(a_seed.y + u_time * u_speed * (0.7 + a_seed.x * 0.6));
  float x = a_seed.x * 2.0 - 1.0;
  float y = 1.0 - fall * 2.0;
  // 轻微风偏，让雨丝倾斜而非完全垂直。
  x += fall * 0.06;
  gl_Position = vec4(x, y, 0.0, 1.0);
  // 雨丝需要足够的像素高度才看得见；按设备像素比补偿高分屏。
  gl_PointSize = 26.0 * u_pixelRatio;
  v_alpha = u_opacity * (0.45 + a_seed.x * 0.55);
}
`

const FRAGMENT_SHADER = `
precision mediump float;
varying float v_alpha;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  // 横向极窄、纵向拉长，形成细长雨丝；两端柔和淡出。
  float across = smoothstep(0.11, 0.0, abs(p.x));
  float along = smoothstep(0.5, 0.24, abs(p.y));
  float shape = across * along;
  if (shape <= 0.01) discard;
  gl_FragColor = vec4(0.78, 0.87, 0.96, shape * v_alpha);
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
    throw new Error(`雨幕着色器编译失败：${message}`)
  }
  return shader
}

export class RainLayer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private seeds: Float32Array
  private maximum: number
  private started = false
  private animationId = 0
  private startTime = 0
  private options: RainLayerOptions = { count: 0, speed: 1, opacity: 0.55 }

  constructor(maximum = 1200) {
    this.maximum = maximum
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'weather-rain-layer'
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
    this.seeds = new Float32Array(maximum * 2)
    for (let i = 0; i < this.seeds.length; i += 1) this.seeds[i] = Math.random()
  }

  private initialize() {
    const gl = this.gl
    if (!gl || this.program) return
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`雨幕着色器链接失败：${gl.getProgramInfoLog(program)}`)
    }
    gl.useProgram(program)
    this.program = program
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.seeds, gl.STATIC_DRAW)
    const location = gl.getAttribLocation(program, 'a_seed')
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private resize() {
    const gl = this.gl
    if (!gl) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    this.pixelRatio = ratio
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
    const elapsed = (now - this.startTime) / 1000
    this.resize()
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(
      gl.getUniformLocation(this.program, 'u_resolution'),
      this.canvas.width,
      this.canvas.height
    )
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), elapsed)
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_speed'),
      this.options.speed
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_opacity'),
      this.options.opacity
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_pixelRatio'),
      this.pixelRatio
    )
    gl.drawArrays(gl.POINTS, 0, Math.min(this.options.count, this.maximum))
    this.animationId = requestAnimationFrame(this.render)
  }

  private active = false
  private pixelRatio = 1

  get element() {
    return this.canvas
  }

  setOptions(options: Partial<RainLayerOptions>) {
    this.options = { ...this.options, ...options }
    const count = Math.max(0, Math.min(this.options.count, this.maximum))
    if (count === 0) {
      this.hide()
      return
    }
    try {
      this.initialize()
    } catch (error) {
      console.warn('降雨效果初始化失败，已跳过雨滴渲染。', error)
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
