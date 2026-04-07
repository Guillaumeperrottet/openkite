import {
  QUAD_VERT,
  SCREEN_FRAG,
  DRAW_VERT,
  DRAW_FRAG,
  UPDATE_FRAG,
} from "./shaders";
import {
  createProgram,
  createTexture,
  bindTexture,
  bindFramebuffer,
  createBuffer,
  bindAttribute,
} from "./util";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WindData {
  width: number; // nLngs
  height: number; // nLats
  image: Uint8Array; // RGBA, width × height
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

type Bounds4 = [number, number, number, number];

// ── WindGL ───────────────────────────────────────────────────────────────────
// Designed to work inside MapLibre's shared WebGL2 context via CustomLayerInterface.
// prerender() does all FBO work (update particles, composite trails).
// render() blits the result into MapLibre's current framebuffer.

export class WindGL {
  gl: WebGL2RenderingContext;

  fadeOpacity = 0.97;
  speedFactor = 0.15;
  dropRate = 0.003;
  dropRateBump = 0.01;
  pointSize = 2.0;

  private _drawProgram: WebGLProgram;
  private _screenProgram: WebGLProgram;
  private _updateProgram: WebGLProgram;

  private _quadBuffer: WebGLBuffer;
  private _framebuffer: WebGLFramebuffer;
  private _colorRampTexture: WebGLTexture;

  private _backgroundTexture!: WebGLTexture;
  private _screenTexture!: WebGLTexture;
  private _screenW = 0;
  private _screenH = 0;

  private _particleStateTexture0!: WebGLTexture;
  private _particleStateTexture1!: WebGLTexture;
  private _particleIndexBuffer!: WebGLBuffer;
  private _particleStateResolution = 0;
  private _numParticles = 0;

  private _windTexture: WebGLTexture | null = null;
  private _windData: WindData | null = null;
  private _windBounds: Bounds4 = [0, 0, 0, 0]; // lng0, lat0, lng1, lat1

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    this._drawProgram = createProgram(gl, DRAW_VERT, DRAW_FRAG);
    this._screenProgram = createProgram(gl, QUAD_VERT, SCREEN_FRAG);
    this._updateProgram = createProgram(gl, QUAD_VERT, UPDATE_FRAG);

    // Full-screen quad: two triangles covering [0,1]²
    this._quadBuffer = createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    );
    this._framebuffer = gl.createFramebuffer()!;
    this._colorRampTexture = this._createColorRamp();

    this.numParticles = 16384;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Allocate/resize screen-space trail textures. Call when canvas size changes. */
  resize(w: number, h: number) {
    if (w === this._screenW && h === this._screenH) return;
    this._screenW = w;
    this._screenH = h;
    const gl = this.gl;
    if (this._backgroundTexture) gl.deleteTexture(this._backgroundTexture);
    if (this._screenTexture) gl.deleteTexture(this._screenTexture);
    const empty = new Uint8Array(w * h * 4);
    this._backgroundTexture = createTexture(gl, gl.NEAREST, empty, w, h);
    this._screenTexture = createTexture(gl, gl.NEAREST, empty, w, h);
  }

  set numParticles(n: number) {
    const gl = this.gl;
    const res = Math.ceil(Math.sqrt(n));
    this._particleStateResolution = res;
    this._numParticles = res * res;

    const state = new Uint8Array(this._numParticles * 4);
    for (let i = 0; i < state.length; i++) {
      state[i] = Math.floor(Math.random() * 256);
    }
    this._particleStateTexture0 = createTexture(
      gl,
      gl.NEAREST,
      state,
      res,
      res,
    );
    this._particleStateTexture1 = createTexture(
      gl,
      gl.NEAREST,
      state,
      res,
      res,
    );

    const indices = new Float32Array(this._numParticles);
    for (let i = 0; i < this._numParticles; i++) indices[i] = i;
    this._particleIndexBuffer = createBuffer(gl, indices);
  }

  get numParticles() {
    return this._numParticles;
  }

  get windBounds() {
    return this._windBounds;
  }

  get hasWind() {
    return this._windData !== null && this._windTexture !== null;
  }

  setWind(data: WindData, bounds: Bounds4) {
    const gl = this.gl;
    if (this._windTexture) gl.deleteTexture(this._windTexture);
    this._windTexture = createTexture(
      gl,
      gl.LINEAR,
      data.image,
      data.width,
      data.height,
    );
    this._windData = data;
    this._windBounds = bounds;
  }

  /**
   * Phase 1: Off-screen FBO work. Call from CustomLayerInterface.prerender().
   * - Composite old trails + new particles into screenTexture (via FBO)
   * - Update particle positions (via FBO)
   * - Swap buffers
   */
  prerender(matrix: Float32Array | Float64Array) {
    if (!this._windData || !this._windTexture || !this._screenW) return;
    const gl = this.gl;

    // Save MapLibre's VAO so we don't corrupt it
    const savedVAO = gl.getParameter(
      gl.VERTEX_ARRAY_BINDING,
    ) as WebGLVertexArrayObject | null;
    gl.bindVertexArray(null);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.BLEND);

    // Step 1: Render trails + new particles into screen FBO
    bindFramebuffer(gl, this._framebuffer, this._screenTexture);
    gl.viewport(0, 0, this._screenW, this._screenH);

    this._drawScreen(this._backgroundTexture, this.fadeOpacity);
    this._drawParticles(matrix);

    // Step 2: Swap screen ↔ background
    const temp = this._backgroundTexture;
    this._backgroundTexture = this._screenTexture;
    this._screenTexture = temp;

    // Step 3: Update particle positions
    this._updateParticles();

    // Unbind FBO — MapLibre will bind its own
    bindFramebuffer(gl, null);

    // Restore MapLibre's VAO
    gl.bindVertexArray(savedVAO);
  }

  /**
   * Phase 2: Blit the screen texture into MapLibre's current framebuffer.
   * Call from CustomLayerInterface.render().
   * MapLibre has already set blend to gl.ONE, gl.ONE_MINUS_SRC_ALPHA (premultiplied).
   */
  render() {
    if (!this._windData || !this._windTexture || !this._screenW) return;
    const gl = this.gl;

    const savedVAO = gl.getParameter(
      gl.VERTEX_ARRAY_BINDING,
    ) as WebGLVertexArrayObject | null;
    gl.bindVertexArray(null);

    gl.viewport(0, 0, this._screenW, this._screenH);
    // MapLibre already enabled blend with premultiplied alpha — just draw
    this._drawScreen(this._backgroundTexture, 1.0);

    gl.bindVertexArray(savedVAO);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteProgram(this._drawProgram);
    gl.deleteProgram(this._screenProgram);
    gl.deleteProgram(this._updateProgram);
    gl.deleteBuffer(this._quadBuffer);
    gl.deleteBuffer(this._particleIndexBuffer);
    gl.deleteFramebuffer(this._framebuffer);
    gl.deleteTexture(this._colorRampTexture);
    if (this._backgroundTexture) gl.deleteTexture(this._backgroundTexture);
    if (this._screenTexture) gl.deleteTexture(this._screenTexture);
    gl.deleteTexture(this._particleStateTexture0);
    gl.deleteTexture(this._particleStateTexture1);
    if (this._windTexture) gl.deleteTexture(this._windTexture);
  }

  // ── Internal draw steps ──────────────────────────────────────────────────

  private _drawScreen(texture: WebGLTexture, opacity: number) {
    const gl = this.gl;
    const p = this._screenProgram;
    gl.useProgram(p);

    bindAttribute(gl, this._quadBuffer, gl.getAttribLocation(p, "a_pos"), 2);
    bindTexture(gl, texture, 0);
    gl.uniform1i(gl.getUniformLocation(p, "u_screen"), 0);
    gl.uniform1f(gl.getUniformLocation(p, "u_opacity"), opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private _drawParticles(matrix: Float32Array | Float64Array) {
    const gl = this.gl;
    const p = this._drawProgram;
    gl.useProgram(p);

    bindAttribute(
      gl,
      this._particleIndexBuffer,
      gl.getAttribLocation(p, "a_index"),
      1,
    );

    bindTexture(gl, this._particleStateTexture0, 0);
    gl.uniform1i(gl.getUniformLocation(p, "u_particles"), 0);
    gl.uniform1f(
      gl.getUniformLocation(p, "u_particles_res"),
      this._particleStateResolution,
    );

    bindTexture(gl, this._windTexture!, 1);
    gl.uniform1i(gl.getUniformLocation(p, "u_wind"), 1);
    gl.uniform2f(
      gl.getUniformLocation(p, "u_wind_min"),
      this._windData!.uMin,
      this._windData!.vMin,
    );
    gl.uniform2f(
      gl.getUniformLocation(p, "u_wind_max"),
      this._windData!.uMax,
      this._windData!.vMax,
    );

    bindTexture(gl, this._colorRampTexture, 2);
    gl.uniform1i(gl.getUniformLocation(p, "u_color_ramp"), 2);

    gl.uniform4f(
      gl.getUniformLocation(p, "u_wind_bounds"),
      this._windBounds[0],
      this._windBounds[1],
      this._windBounds[2],
      this._windBounds[3],
    );

    // Pass the MapLibre model-view-projection matrix as Float32
    const loc = gl.getUniformLocation(p, "u_matrix");
    if (matrix instanceof Float32Array) {
      gl.uniformMatrix4fv(loc, false, matrix);
    } else {
      gl.uniformMatrix4fv(loc, false, new Float32Array(matrix));
    }

    gl.uniform1f(
      gl.getUniformLocation(p, "u_point_size"),
      this.pointSize *
        (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    );

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }

  private _updateParticles() {
    const gl = this.gl;
    const p = this._updateProgram;

    bindFramebuffer(gl, this._framebuffer, this._particleStateTexture1);
    gl.viewport(
      0,
      0,
      this._particleStateResolution,
      this._particleStateResolution,
    );

    gl.useProgram(p);

    bindAttribute(gl, this._quadBuffer, gl.getAttribLocation(p, "a_pos"), 2);

    bindTexture(gl, this._particleStateTexture0, 0);
    gl.uniform1i(gl.getUniformLocation(p, "u_particles"), 0);

    bindTexture(gl, this._windTexture!, 1);
    gl.uniform1i(gl.getUniformLocation(p, "u_wind"), 1);
    gl.uniform2f(
      gl.getUniformLocation(p, "u_wind_min"),
      this._windData!.uMin,
      this._windData!.vMin,
    );
    gl.uniform2f(
      gl.getUniformLocation(p, "u_wind_max"),
      this._windData!.uMax,
      this._windData!.vMax,
    );

    gl.uniform1f(gl.getUniformLocation(p, "u_speed_factor"), this.speedFactor);
    gl.uniform1f(gl.getUniformLocation(p, "u_drop_rate"), this.dropRate);
    gl.uniform1f(
      gl.getUniformLocation(p, "u_drop_rate_bump"),
      this.dropRateBump,
    );
    gl.uniform1f(gl.getUniformLocation(p, "u_rand_seed"), Math.random());
    gl.uniform4f(
      gl.getUniformLocation(p, "u_wind_bounds"),
      this._windBounds[0],
      this._windBounds[1],
      this._windBounds[2],
      this._windBounds[3],
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap particle state textures
    const temp = this._particleStateTexture0;
    this._particleStateTexture0 = this._particleStateTexture1;
    this._particleStateTexture1 = temp;
  }

  // ── Colour ramp ──────────────────────────────────────────────────────────

  private _createColorRamp(): WebGLTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 256, 0);

    // Windguru-style palette (absolute km/h mapped to 0–80 range)
    g.addColorStop(0, "#d0d0d0"); //  0 km/h – calme
    g.addColorStop(0.05, "#d5f0d5"); //  4 km/h – très léger
    g.addColorStop(0.115, "#8edb8e"); //  9 km/h – léger
    g.addColorStop(0.19, "#3dbc3d"); // 15 km/h – modéré
    g.addColorStop(0.28, "#e8e540"); // 22 km/h – kitable
    g.addColorStop(0.375, "#e8b830"); // 30 km/h – bon
    g.addColorStop(0.465, "#e07020"); // 37 km/h – fort
    g.addColorStop(0.575, "#d42020"); // 46 km/h – très fort
    g.addColorStop(0.7, "#b00058"); // 56 km/h – extrême
    g.addColorStop(0.82, "#800080"); // 65 km/h – danger
    g.addColorStop(1.0, "#800080"); // 80+ km/h

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 1);

    const data = new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
    return createTexture(this.gl, this.gl.LINEAR, data, 256, 1);
  }
}
