// Detect whether WebGL is hardware accelerated. With hardware acceleration disabled, browsers fall back to a
// CPU renderer (SwiftShader, llvmpipe, Microsoft Basic Render…) that runs the rain scene at a crawl.

export type GpuCapability = "ok" | "software" | "none";

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|google .*cpu/i;

export function detectGpu(): GpuCapability {
  try {
    // Browsers refuse this flag when the context would be noticeably slow (e.g. a software fallback)
    const fastOpts = { failIfMajorPerformanceCaveat: true } as WebGLContextAttributes;
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2", fastOpts) || c.getContext("webgl", fastOpts)) as WebGLRenderingContext | null;
    if (!gl) {
      const any = document.createElement("canvas");
      const fallback = (any.getContext("webgl2") || any.getContext("webgl")) as WebGLRenderingContext | null;
      fallback?.getExtension("WEBGL_lose_context")?.loseContext();
      return fallback ? "software" : "none";
    }
    // Some browsers don't honour the flag, so also check the renderer's name
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return SOFTWARE_RENDERER.test(renderer) ? "software" : "ok";
  } catch {
    return "none";
  }
}
