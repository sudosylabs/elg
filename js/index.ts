import { loadNative } from "./native-loader.js";

export interface GlassOptions {
  cornerRadius?: number;
  /** sRGB #RRGGBB or #RRGGBBAA. Omit to clear a previous tint. */
  tintColor?: string;
  opaque?: boolean;
}

export interface GlassNative {
  isSupported(): boolean;
  addView(handle: Buffer, options: GlassOptions): number;
  updateView(id: number, options: GlassOptions): boolean;
  removeView(id: number): boolean;
  dispose(): void;
}

export interface GlassRuntime {
  readonly platform: string;
  readonly pointerSize: number;
  load(): GlassNative;
}

const defaultRuntime: GlassRuntime = {
  platform: process.platform,
  pointerSize: 8,
  load: loadNative,
};

/** Main-process owner. A disposed owner cannot be reused. No Electron dependency. */
export class LiquidGlass {
  private addon: GlassNative | undefined;
  private attemptedLoad = false;
  private disposed = false;
  private error: unknown;

  constructor(private readonly runtime: GlassRuntime = defaultRuntime) {}

  /** Native load failures are inspectable without logging or breaking app startup. */
  get loadError(): unknown {
    return this.error;
  }

  private getAddon(): GlassNative | undefined {
    if (this.disposed || this.runtime.platform !== "darwin") return undefined;
    if (!this.attemptedLoad) {
      this.attemptedLoad = true;
      try {
        this.addon = this.runtime.load();
      } catch (error) {
        this.error = error;
      }
    }
    return this.addon;
  }

  isGlassSupported(): boolean {
    return this.getAddon()?.isSupported() ?? false;
  }

  /** Only accepts a live Electron BrowserWindow handle; never accept renderer bytes. */
  addView(handle: Buffer, options: GlassOptions = {}): number {
    if (!Buffer.isBuffer(handle) || handle.length !== this.runtime.pointerSize || handle.every(byte => byte === 0)) {
      throw new TypeError("handle must be a non-null native window pointer Buffer");
    }
    this.validateOptions(options);
    const addon = this.getAddon();
    if (!addon?.isSupported()) return -1;
    return addon.addView(handle, options);
  }

  /** Replaces all presentation options, including clearing an omitted tint. */
  updateView(id: number, options: GlassOptions = {}): boolean {
    this.validateId(id);
    this.validateOptions(options);
    return this.getAddon()?.updateView(id, options) ?? false;
  }

  /** Idempotent: false means this owner has no matching live attachment. */
  removeView(id: number): boolean {
    this.validateId(id);
    return this.addon?.removeView(id) ?? false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.addon?.dispose();
    this.disposed = true;
    this.addon = undefined;
  }

  private validateId(id: number): void {
    if (!Number.isInteger(id) || id < 0 || id > 0x7fffffff) {
      throw new TypeError("view id must be a non-negative int32");
    }
  }

  private validateOptions(options: GlassOptions): void {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must be an object");
    }
    if (options.cornerRadius !== undefined && (!Number.isFinite(options.cornerRadius) || options.cornerRadius < 0)) {
      throw new TypeError("cornerRadius must be finite and non-negative");
    }
    if (options.tintColor !== undefined && (typeof options.tintColor !== "string" || !/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(options.tintColor))) {
      throw new TypeError("tintColor must be #RRGGBB or #RRGGBBAA");
    }
    if (options.opaque !== undefined && typeof options.opaque !== "boolean") {
      throw new TypeError("opaque must be a boolean");
    }
  }
}

const liquidGlass: LiquidGlass = new LiquidGlass();
export default liquidGlass;
