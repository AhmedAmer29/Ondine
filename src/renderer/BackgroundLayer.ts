import { Container, FillGradient, Graphics, Sprite } from 'pixi.js';
import type { CustomizationSettings } from '@/types';
import { hexToNumber } from '@/utils/color';
import { getDotTexture } from './particleTextures';

const MAX_PARTICLES = 160;
/** Particles are forced on — this is the floor on how many show even if `particleAmount` is at its minimum (e.g. a stale persisted value from before it was forced). */
const MIN_ACTIVE_PARTICLES = 40;
const MAX_RAYS = 3;
const STAR_COUNT = 110;

/** Deterministic pseudo-random in [0, 1) from a seed — keeps layout reproducible without Math.random(). */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface Particle {
  readonly sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  radius: number;
  age: number;
  lifetime: number;
}

const PARTICLE_FADE_IN_FRACTION = 0.1;
const PARTICLE_FADE_OUT_FRACTION = 0.18;

/** Gives a particle a fresh random position, velocity, and lifetime — used both on first layout and every recycle. */
function respawnParticle(p: Particle, width: number, height: number): void {
  p.x = Math.random() * width;
  p.y = Math.random() * height;
  const angle = Math.random() * Math.PI * 2;
  const speed = 3 + Math.random() * 9;
  p.vx = Math.cos(angle) * speed;
  // A gentle upward bias on top of the random direction, like dust catching a slow rising current.
  p.vy = Math.sin(angle) * speed - 2 - Math.random() * 3;
  p.radius = 0.7 + Math.random() * 1.6;
  p.baseAlpha = 0.15 + Math.random() * 0.35;
  p.age = 0;
  p.lifetime = 14 + Math.random() * 18;
}

interface AuroraBlob {
  readonly gfx: Graphics;
  baseX: number;
  baseY: number;
  driftRadius: number;
  driftSpeed: number;
  phase: number;
}

interface LightRay {
  readonly gfx: Graphics;
  readonly bandGfx: Graphics;
  baseX: number;
  baseAngle: number;
  swayAmount: number;
  swaySpeed: number;
  phase: number;
  bandPhase: number;
  rayWidth: number;
}

interface Star {
  readonly gfx: Graphics;
  x: number;
  y: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

function numberToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function radialFadeGradient(colorHex: string): FillGradient {
  return new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: colorHex },
      { offset: 1, color: 'rgba(0,0,0,0)' },
    ],
  });
}

/** Cinematic backdrop: matte gradient base, slow-drifting aurora blobs, floating particles, light rays, and a vignette. */
export class BackgroundLayer {
  readonly container: Container;
  private readonly base: Graphics;
  private readonly auroraContainer: Container;
  private readonly starsContainer: Container;
  private readonly rayContainer: Container;
  private readonly particleContainer: Container;
  private readonly vignette: Graphics;

  private blobs: AuroraBlob[] = [];
  private stars: Star[] = [];
  private rays: LightRay[] = [];
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private elapsed = 0;

  constructor() {
    this.container = new Container();
    this.base = new Graphics();
    this.auroraContainer = new Container();
    this.starsContainer = new Container();
    this.rayContainer = new Container();
    this.particleContainer = new Container();
    this.vignette = new Graphics();

    this.container.addChild(this.base, this.auroraContainer, this.starsContainer, this.rayContainer, this.particleContainer, this.vignette);

    const dotTexture = getDotTexture();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const sprite = new Sprite(dotTexture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.particleContainer.addChild(sprite);
      this.particles.push({ sprite, x: 0, y: 0, vx: 0, vy: 0, baseAlpha: 0, radius: 1, age: Math.random() * 20, lifetime: 20 });
    }
    for (let i = 0; i < MAX_RAYS; i++) {
      const gfx = new Graphics();
      gfx.blendMode = 'add';
      const bandGfx = new Graphics();
      bandGfx.blendMode = 'add';
      // A sibling in the same container, not a child of `gfx`: Graphics.addChild is deprecated
      // (Pixi warns it will be removed once Graphics is no longer treated as a Container), so its
      // transform is mirrored onto bandGfx by hand in `update()` instead of inheriting it for free.
      this.rayContainer.addChild(gfx, bandGfx);
      this.rays.push({ gfx, bandGfx, baseX: 0, baseAngle: 0, swayAmount: 0, swaySpeed: 0, phase: (i / MAX_RAYS) * Math.PI * 2, bandPhase: i / MAX_RAYS, rayWidth: 0 });
    }
    for (let i = 0; i < 3; i++) {
      const gfx = new Graphics();
      gfx.blendMode = 'add';
      this.auroraContainer.addChild(gfx);
      this.blobs.push({ gfx, baseX: 0, baseY: 0, driftRadius: 0, driftSpeed: 0, phase: (i / 3) * Math.PI * 2 });
    }
    for (let i = 0; i < STAR_COUNT; i++) {
      const gfx = new Graphics();
      this.starsContainer.addChild(gfx);
      this.stars.push({ gfx, x: 0, y: 0, baseAlpha: 0.25 + hash(i * 3.1) * 0.55, twinkleSpeed: 0.3 + hash(i * 7.7) * 0.9, phase: hash(i * 5.3) * Math.PI * 2 });
    }
  }

  resize(width: number, height: number, settings: CustomizationSettings): void {
    this.width = width;
    this.height = height;
    this.redrawBase(settings);
    this.layoutAurora(settings);
    this.layoutStars(width, height, settings);
    this.layoutRays(width, height);
    this.layoutParticles(width, height, settings);
    this.redrawVignette(width, height);
  }

  updateCustomization(settings: CustomizationSettings): void {
    this.redrawBase(settings);
    this.layoutAurora(settings);
    this.layoutStars(this.width, this.height, settings);
    this.rayContainer.visible = settings.showLightRays;
    this.vignette.visible = settings.showVignette;
    this.layoutParticles(this.width, this.height, settings);
  }

  private redrawBase(settings: CustomizationSettings): void {
    if (this.width <= 0 || this.height <= 0) return;
    this.base.clear();
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: settings.backgroundGradient.from },
        { offset: 1, color: settings.backgroundGradient.to },
      ],
    });
    this.base.rect(0, 0, this.width, this.height).fill({ fill: gradient });
  }

  /**
   * Each background style gets a genuinely different look, not just a shared
   * layer with a tweaked alpha:
   *  - matte: no color blobs at all — a flat, minimal gradient.
   *  - aurora: broad, slow, colorful blobs in the hand colors — flowing curtains of light.
   *  - nebula: tighter, brighter, cosmic-toned (magenta/cyan/violet) clouds, paired with a starfield.
   *  - midnight: blobs off entirely, just a sparse twinkling starfield over a darker base.
   */
  private layoutAurora(settings: CustomizationSettings): void {
    if (this.width <= 0 || this.height <= 0) return;
    const style = settings.backgroundStyle;
    const radius = Math.max(this.width, this.height) * (style === 'nebula' ? 0.32 : 0.5);
    const baseAlpha = style === 'aurora' ? 0.09 : style === 'nebula' ? 0.1 : 0;
    const colors =
      style === 'nebula'
        ? [0xe94fd8, 0x22d3ee, 0x7c3aed]
        : [hexToNumber(settings.rightHandGradient.to), hexToNumber(settings.leftHandGradient.to), 0x8b5cf6];

    this.blobs.forEach((blob, i) => {
      const gradient = radialFadeGradient(numberToCss(colors[i % colors.length] as number));
      blob.gfx.clear();
      if (baseAlpha > 0) blob.gfx.circle(0, 0, radius).fill({ fill: gradient });
      blob.gfx.alpha = baseAlpha;
      blob.baseX = this.width * (0.2 + 0.3 * i);
      blob.baseY = this.height * (0.25 + 0.2 * ((i + 1) % 3));
      blob.driftRadius = Math.min(this.width, this.height) * (style === 'nebula' ? 0.07 : 0.12);
      blob.driftSpeed = 0.03 + i * 0.01;
    });
  }

  private layoutStars(width: number, height: number, settings: CustomizationSettings): void {
    if (width <= 0 || height <= 0) return;
    const visible = settings.backgroundStyle === 'nebula' || settings.backgroundStyle === 'midnight';
    this.starsContainer.visible = visible;
    if (!visible) return;

    this.stars.forEach((star, i) => {
      star.x = hash(i * 11.3 + 1) * width;
      star.y = hash(i * 17.9 + 2) * height * 0.85;
      const radius = 0.5 + hash(i * 4.7) * 1.1;
      star.gfx.clear();
      star.gfx.circle(0, 0, radius).fill({ color: 0xffffff });
      star.gfx.position.set(star.x, star.y);
    });
  }

  /** One soft, cool-toned layer of a volumetric ray — three of these nested (wide+faint to narrow+bright) fake a gaussian-soft edge. */
  private static rayLayerGradient(peakAlpha: number): FillGradient {
    return new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: `rgba(223,233,255,${peakAlpha})` },
        { offset: 0.75, color: `rgba(223,233,255,${peakAlpha * 0.35})` },
        { offset: 1, color: 'rgba(223,233,255,0)' },
      ],
    });
  }

  /**
   * A gently bent (not perfectly straight-edged) beam silhouette. Real light
   * shafts waver slightly from air turbulence and drifting dust — a flawless
   * geometric trapezoid is what makes a ray read as "a shape" instead of
   * light. Each of the three layered widths gets its own slightly different
   * bend so their edges don't stay concentric all the way down.
   */
  private static buildRaySilhouette(rayWidth: number, height: number, seed: number): number[] {
    const segments = 6;
    const bendAmount = rayWidth * (0.1 + hash(seed) * 0.14);
    const bendFreq = 1 + hash(seed * 2.3) * 0.5;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * height;
      const wAtT = rayWidth * (1 + t * 1.6);
      const bend = Math.sin(t * Math.PI * bendFreq + hash(seed * 5.1) * Math.PI) * bendAmount * t;
      left.push([-wAtT / 2 + bend, y]);
      right.push([wAtT / 2 + bend, y]);
    }
    const points: number[] = [];
    for (const [x, y] of left) points.push(x, y);
    for (let i = right.length - 1; i >= 0; i--) points.push((right[i] as [number, number])[0], (right[i] as [number, number])[1]);
    return points;
  }

  private layoutRays(width: number, height: number): void {
    const widthScales = [0.68, 1.05, 0.85];
    const baseAngles = [0.09, 0.16, 0.12];
    const xFractions = [0.12, 0.46, 0.8];

    this.rays.forEach((ray, i) => {
      const rayWidth = width * 0.15 * (widthScales[i % widthScales.length] as number);
      ray.rayWidth = rayWidth;
      ray.gfx.clear();

      // A soft glow at the source, like the light is actually coming from
      // somewhere just off the top edge rather than starting mid-air.
      ray.gfx.circle(0, rayWidth * 0.15, rayWidth * 1.3).fill({ fill: radialFadeGradient('rgba(235,242,255,0.85)') });

      // Layered widths + fading alpha simulate a soft volumetric falloff instead of one hard-edged shape.
      const layers: { scale: number; alpha: number }[] = [
        { scale: 2.6, alpha: 0.028 },
        { scale: 1.7, alpha: 0.05 },
        { scale: 1, alpha: 0.085 },
      ];
      layers.forEach((layer, layerIndex) => {
        const w = rayWidth * layer.scale;
        const gradient = BackgroundLayer.rayLayerGradient(layer.alpha);
        const points = BackgroundLayer.buildRaySilhouette(w, height, i * 17 + layerIndex * 5);
        ray.gfx.poly(points).fill({ fill: gradient });
      });

      ray.baseX = width * (xFractions[i % xFractions.length] as number);
      ray.baseAngle = baseAngles[i % baseAngles.length] as number;
      ray.swayAmount = 0.03 + i * 0.012;
      ray.swaySpeed = 0.05 + i * 0.015;
      ray.gfx.position.set(ray.baseX, -height * 0.08);
      ray.gfx.rotation = ray.baseAngle;
      // bandGfx is a sibling, not a child of gfx (see constructor) — give it the same base transform here.
      ray.bandGfx.position.set(ray.baseX, -height * 0.08);
      ray.bandGfx.rotation = ray.baseAngle;
    });
  }

  /** Slow drifting brightness bands inside a ray, like dust motes catching the light as they fall through it. */
  private drawRayBands(ray: LightRay, dt: number): void {
    ray.bandPhase = (ray.bandPhase + dt * 0.05) % 1;
    const g = ray.bandGfx;
    g.clear();
    const bandCount = 2;
    for (let i = 0; i < bandCount; i++) {
      const t = (ray.bandPhase + i / bandCount) % 1;
      const y = t * this.height;
      const w = ray.rayWidth * (1 + t * 1.1);
      const alpha = 0.06 * Math.sin(t * Math.PI);
      if (alpha <= 0.003) continue;
      g.ellipse(0, y, w * 0.5, Math.max(4, this.height * 0.03)).fill({ color: 0xeef4ff, alpha });
    }
  }

  private layoutParticles(width: number, height: number, settings: CustomizationSettings): void {
    if (width <= 0 || height <= 0) return;
    const activeCount = Math.max(MIN_ACTIVE_PARTICLES, Math.round(MAX_PARTICLES * settings.particleAmount));
    this.particles.forEach((p, i) => {
      const active = i < activeCount;
      const wasVisible = p.sprite.visible;
      p.sprite.visible = active;
      if (!active) return;
      // Only respawn particles that are newly turning on — a resize or an
      // unrelated settings change shouldn't reset ones that are already
      // mid-flight, or every particle would visibly "restart" together.
      if (!wasVisible) {
        respawnParticle(p, width, height);
        p.sprite.tint = 0xffffff;
        p.sprite.width = p.radius * 2;
        p.sprite.height = p.radius * 2;
      }
    });
  }

  private redrawVignette(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.vignette.clear();
    const gradient = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.75,
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 1, color: 'rgba(0,0,0,0.55)' },
      ],
    });
    this.vignette.rect(0, 0, width, height).fill({ fill: gradient });
  }

  update(dt: number): void {
    this.elapsed += dt;

    for (const blob of this.blobs) {
      blob.gfx.position.set(
        blob.baseX + Math.cos(this.elapsed * blob.driftSpeed + blob.phase) * blob.driftRadius,
        blob.baseY + Math.sin(this.elapsed * blob.driftSpeed * 0.8 + blob.phase) * blob.driftRadius,
      );
    }

    const margin = 24;
    for (const p of this.particles) {
      if (!p.sprite.visible) continue;

      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const driftedOffscreen = p.x < -margin || p.x > this.width + margin || p.y < -margin || p.y > this.height + margin;
      if (p.age >= p.lifetime || driftedOffscreen) {
        respawnParticle(p, this.width, this.height);
        p.sprite.width = p.radius * 2;
        p.sprite.height = p.radius * 2;
      }

      // Smooth fade in on spawn, steady in the middle, smooth fade out before the next respawn —
      // continuous and gapless, so recycling never reads as a pop or a teleport.
      const progress = p.age / p.lifetime;
      const fadeIn = Math.min(1, progress / PARTICLE_FADE_IN_FRACTION);
      const fadeOut = Math.min(1, (1 - progress) / PARTICLE_FADE_OUT_FRACTION);
      const envelope = Math.max(0, Math.min(fadeIn, fadeOut));

      p.sprite.position.set(p.x, p.y);
      p.sprite.alpha = p.baseAlpha * envelope;
    }

    for (const ray of this.rays) {
      const sway = Math.sin(this.elapsed * ray.swaySpeed + ray.phase);
      const rotation = ray.baseAngle + sway * ray.swayAmount;
      const x = ray.baseX + sway * this.width * 0.015;
      const alpha = 0.75 + 0.25 * Math.sin(this.elapsed * 0.12 + ray.phase);
      ray.gfx.rotation = rotation;
      ray.gfx.position.x = x;
      ray.gfx.alpha = alpha;
      // bandGfx is a sibling, not a child of gfx, so its transform is mirrored here by hand.
      ray.bandGfx.rotation = rotation;
      ray.bandGfx.position.x = x;
      ray.bandGfx.alpha = alpha;
      this.drawRayBands(ray, dt);
    }

    if (this.starsContainer.visible) {
      for (const star of this.stars) {
        star.gfx.alpha = star.baseAlpha * (0.55 + 0.45 * Math.sin(this.elapsed * star.twinkleSpeed + star.phase));
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
