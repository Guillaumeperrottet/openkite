import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from "maplibre-gl";
import { WindGL, type WindData } from "./WindGL";

/**
 * MapLibre custom layer that renders GPU-accelerated wind particles.
 * Uses WindGL for the heavy lifting, but integrates into MapLibre's
 * own WebGL2 context so particles render during zoom/rotate — no canvas overlay.
 */
export class WindParticleLayer implements CustomLayerInterface {
  readonly id = "wind-particles";
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;

  private _map: MapLibreMap | null = null;
  private _windgl: WindGL | null = null;
  private _pendingWind: {
    data: WindData;
    bounds: [number, number, number, number];
  } | null = null;

  // ── CustomLayerInterface lifecycle ──────────────────────────────────────

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this._map = map;
    const gl2 = gl as WebGL2RenderingContext;
    this._windgl = new WindGL(gl2);

    // Size screen textures to match the actual canvas
    const { width, height } = gl2.canvas;
    this._windgl.resize(width, height);

    // If setWind was called before onAdd, apply it now
    if (this._pendingWind) {
      this._windgl.setWind(this._pendingWind.data, this._pendingWind.bounds);
      this._pendingWind = null;
    }

    // Keep screen textures in sync when the canvas resizes
    map.on("resize", this._onResize);
  }

  prerender(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    options: CustomRenderMethodInput,
  ) {
    if (!this._windgl?.hasWind) return;

    // Canvas may have resized between frames (devicePixelRatio change, etc.)
    this._windgl.resize(gl.canvas.width, gl.canvas.height);
    this._windgl.prerender(
      options.modelViewProjectionMatrix as unknown as Float32Array,
    );
  }

  render(
    _gl: WebGLRenderingContext | WebGL2RenderingContext,
    _options: CustomRenderMethodInput,
  ) {
    if (!this._windgl?.hasWind) return;
    this._windgl.render();

    // Request continuous repaints so particles animate
    this._map?.triggerRepaint();
  }

  onRemove(
    _map: MapLibreMap,
    _gl: WebGLRenderingContext | WebGL2RenderingContext,
  ) {
    this._map?.off("resize", this._onResize);
    this._windgl?.destroy();
    this._windgl = null;
    this._map = null;
  }

  // ── Public API (called by the React hook) ──────────────────────────────

  setWind(data: WindData, bounds: [number, number, number, number]) {
    if (this._windgl) {
      this._windgl.setWind(data, bounds);
    } else {
      // Store until onAdd fires
      this._pendingWind = { data, bounds };
    }
  }

  // ── Private ────────────────────────────────────────────────────────────

  private _onResize = () => {
    if (!this._windgl || !this._map) return;
    const canvas = this._map.getCanvas();
    this._windgl.resize(canvas.width, canvas.height);
  };
}
