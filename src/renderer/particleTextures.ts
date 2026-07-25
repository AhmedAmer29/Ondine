import { Texture } from 'pixi.js';

let glowTexture: Texture | null = null;
let shardTexture: Texture | null = null;
let dotTexture: Texture | null = null;
let ringTexture: Texture | null = null;
let sparkleTexture: Texture | null = null;

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for particle texture generation.');
  draw(ctx);
  return Texture.from(canvas);
}

/**
 * A soft white radial-gradient circle, baked once via Canvas2D (not the Pixi
 * renderer, so it's safe to call before the Application has finished
 * `init()`ing). Every glow, particle, and spark in the app tints and scales
 * this same texture instead of tessellating fresh Graphics shapes each
 * frame — a Sprite is just a textured quad, so hundreds of them batch into a
 * handful of draw calls where the equivalent Graphics circles could not.
 */
export function getGlowTexture(): Texture {
  if (glowTexture) return glowTexture;
  glowTexture = canvasTexture(128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
  return glowTexture;
}

/** A small, mostly-opaque dot with just enough edge falloff to avoid hard aliasing — for dust and sparks that should read as solid points rather than glows. */
export function getDotTexture(): Texture {
  if (dotTexture) return dotTexture;
  dotTexture = canvasTexture(32, (ctx) => {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  });
  return dotTexture;
}

/** A soft-edged ring, for impact ripples — a scaled Sprite instead of a Graphics stroke redrawn every frame. */
export function getRingTexture(): Texture {
  if (ringTexture) return ringTexture;
  ringTexture = canvasTexture(128, (ctx) => {
    ctx.translate(64, 64);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 9;
    ctx.filter = 'blur(3px)';
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.stroke();
  });
  return ringTexture;
}

/** A four-point glint/star, for a rotating "shine" highlight on the impact flash and held-note glow. */
export function getSparkleTexture(): Texture {
  if (sparkleTexture) return sparkleTexture;
  sparkleTexture = canvasTexture(128, (ctx) => {
    ctx.translate(64, 64);
    ctx.fillStyle = 'white';
    const drawPoint = (length: number, width: number): void => {
      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.quadraticCurveTo(width, 0, 0, length);
      ctx.quadraticCurveTo(-width, 0, 0, -length);
      ctx.closePath();
      ctx.fill();
    };
    drawPoint(62, 5);
    ctx.rotate(Math.PI / 2);
    drawPoint(62, 5);
    ctx.rotate(-Math.PI / 2);
    ctx.save();
    ctx.rotate(Math.PI / 4);
    drawPoint(30, 3);
    ctx.rotate(Math.PI / 2);
    drawPoint(30, 3);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  });
  return sparkleTexture;
}

/** A faceted diamond shard with a bright core, for the crystalline sparks in the hit-impact burst. */
export function getShardTexture(): Texture {
  if (shardTexture) return shardTexture;
  shardTexture = canvasTexture(64, (ctx) => {
    ctx.translate(32, 32);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 30);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
  });
  return shardTexture;
}
