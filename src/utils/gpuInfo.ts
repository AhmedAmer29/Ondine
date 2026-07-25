export interface GpuInfo {
  readonly vendor: string;
  readonly renderer: string;
}

let cached: GpuInfo | null = null;

/** Reads GPU vendor/renderer strings via the standard WEBGL_debug_renderer_info extension. */
export function getGpuInfo(): GpuInfo {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
  if (!gl) {
    cached = { vendor: 'unavailable', renderer: 'unavailable' };
    return cached;
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  cached = debugInfo
    ? {
        vendor: String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)),
        renderer: String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)),
      }
    : { vendor: String(gl.getParameter(gl.VENDOR)), renderer: String(gl.getParameter(gl.RENDERER)) };

  return cached;
}
