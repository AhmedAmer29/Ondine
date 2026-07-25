import { Container, Sprite } from 'pixi.js';
import { lighten } from '@/utils/color';
import { getDotTexture, getGlowTexture, getRingTexture, getShardTexture, getSparkleTexture } from './particleTextures';

const BURST_DURATION = 0.55;
const SPARK_COUNT = 18;
const SUSTAIN_FADE_IN_RATE = 16;
const SUSTAIN_FADE_OUT_RATE = 5.5;
/** How often a held note's glow spawns a fresh drifting dot, in seconds. */
const SUSTAIN_SPARK_INTERVAL = 0.1;
const SUSTAIN_SPARK_MAX = 140;

export interface ActiveGlowTarget {
  readonly x: number;
  readonly color: number;
}

function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/** Deterministic pseudo-random in [0, 1) from an integer seed — keeps bursts reproducible without Math.random. */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface BurstSpark {
  readonly sprite: Sprite;
  angle: number;
  speed: number;
  size: number;
  lifeOffset: number;
  isShard: boolean;
}

interface Burst {
  readonly root: Container;
  readonly wash: Sprite;
  readonly flashCore: Sprite;
  readonly flashHalo: Sprite;
  readonly sparkle: Sprite;
  readonly ringInner: Sprite;
  readonly ringOuter: Sprite;
  readonly sparks: BurstSpark[];
  active: boolean;
  elapsed: number;
  color: number;
  vividColor: number;
  seed: number;
}

interface SustainSpark {
  readonly sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
}

interface SustainGlow {
  readonly root: Container;
  readonly halo: Sprite;
  readonly mid: Sprite;
  readonly core: Sprite;
  readonly sparkle: Sprite;
  midi: number;
  x: number;
  color: number;
  vividColor: number;
  alpha: number;
  targetAlpha: number;
  phase: number;
  sparkTimer: number;
}

/**
 * Sprite-based impact feedback with two distinct parts:
 *
 *  - A short one-shot burst the instant a note lands: a bright flash, a
 *    rotating glint, double ripple rings, and a fan of crystalline sparks
 *    (small glassy shards mixed with soft dots) with per-particle velocity
 *    variation.
 *  - A separate sustained glow that stays lit for as long as the note is
 *    actually held, fading in on press and smoothly out on release — driven
 *    every frame by the current set of sounding notes rather than a fixed
 *    timer — plus a steady trickle of drifting dots for as long as it's lit.
 *
 * Everything here is a pooled Sprite tinted from a handful of pre-baked
 * soft-edged textures (see `particleTextures.ts`), not a Graphics shape
 * re-tessellated every frame — Pixi batches sprites sharing a texture into
 * very few draw calls, which is what makes dozens of simultaneous sparks
 * across a dense chord cheap instead of a per-frame CPU cost. All glow color
 * comes directly from the hand color of the note that struck the key.
 */
export class HitEffectsLayer {
  readonly container: Container;
  private readonly burstPool: Burst[] = [];
  private readonly activeBursts: Burst[] = [];
  private readonly sustainedGlows = new Map<number, SustainGlow>();
  private readonly sustainGlowPool: SustainGlow[] = [];
  private readonly sustainSparks: SustainSpark[] = [];
  private readonly sustainSparkPool: SustainSpark[] = [];
  private nextSeed = 0;
  private elapsed = 0;

  constructor() {
    this.container = new Container();
  }

  private createSustainSparkSprite(): Sprite {
    const sprite = new Sprite(getGlowTexture());
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.visible = false;
    this.container.addChild(sprite);
    return sprite;
  }

  private createGlowSprite(): Sprite {
    const sprite = new Sprite(getGlowTexture());
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    return sprite;
  }

  trigger(x: number, y: number, color: number): void {
    let burst = this.burstPool.pop();
    if (!burst) {
      const root = new Container();
      const wash = this.createGlowSprite();
      const flashHalo = this.createGlowSprite();
      const flashCore = this.createGlowSprite();
      const sparkle = new Sprite(getSparkleTexture());
      sparkle.anchor.set(0.5);
      sparkle.blendMode = 'add';
      const ringOuter = new Sprite(getRingTexture());
      ringOuter.anchor.set(0.5);
      ringOuter.blendMode = 'add';
      const ringInner = new Sprite(getRingTexture());
      ringInner.anchor.set(0.5);
      ringInner.blendMode = 'add';
      root.addChild(wash, flashHalo, ringOuter, ringInner, sparkle, flashCore);
      this.container.addChild(root);
      burst = { root, wash, flashCore, flashHalo, sparkle, ringInner, ringOuter, sparks: [], active: false, elapsed: 0, color: 0xffffff, vividColor: 0xffffff, seed: 0 };
    }

    burst.active = true;
    burst.elapsed = 0;
    burst.color = color;
    burst.vividColor = lighten(color, 0.08);
    burst.root.visible = true;
    burst.root.position.set(x, y);
    burst.wash.tint = burst.vividColor;
    burst.flashHalo.tint = burst.vividColor;
    burst.ringOuter.tint = burst.vividColor;
    burst.flashCore.tint = 0xffffff;
    burst.ringInner.tint = 0xffffff;
    burst.sparkle.tint = 0xffffff;
    burst.seed = this.nextSeed++;
    this.fillBurstSparks(burst);
    this.activeBursts.push(burst);
  }

  private fillBurstSparks(burst: Burst): void {
    const dotTexture = getDotTexture();
    const shardTexture = getShardTexture();
    for (let i = 0; i < SPARK_COUNT; i++) {
      const h1 = hash(burst.seed * 97 + i * 13.37);
      const h2 = hash(burst.seed * 53 + i * 7.91);
      const h3 = hash(burst.seed * 31 + i * 3.14);
      const baseAngle = (i / SPARK_COUNT) * Math.PI * 2;
      // Mostly an upward/outward fan, with enough per-spark scatter that it doesn't read as a perfect circle.
      const angle = -Math.PI / 2 + Math.sin(baseAngle + h1 * 2) * 1.6 + (h2 - 0.5) * 0.9;
      const speed = 34 + h2 * 66;
      const size = 1 + h3 * 2.6;
      const lifeOffset = h1 * 0.15;
      const isShard = size > 2.6;

      const existing = burst.sparks[i];
      if (existing) {
        existing.angle = angle;
        existing.speed = speed;
        existing.size = size;
        existing.lifeOffset = lifeOffset;
        if (existing.isShard !== isShard) {
          existing.sprite.texture = isShard ? shardTexture : dotTexture;
          existing.isShard = isShard;
        }
      } else {
        const sprite = new Sprite(isShard ? shardTexture : dotTexture);
        sprite.anchor.set(0.5);
        sprite.blendMode = 'add';
        burst.root.addChild(sprite);
        burst.sparks.push({ sprite, angle, speed, size, lifeOffset, isShard });
      }
    }
  }

  /**
   * Call every frame with exactly the notes currently sounding. Any midi
   * missing from `active` that still has a glow fades it out and releases it
   * back to the pool once fully faded — this is what makes the glow track
   * the note's real duration instead of a fixed timer.
   */
  syncSustainedGlows(active: ReadonlyMap<number, ActiveGlowTarget>, y: number, dt: number): void {
    for (const [midi, target] of active) {
      let glow = this.sustainedGlows.get(midi);
      if (!glow) {
        glow = this.sustainGlowPool.pop();
        if (!glow) {
          const root = new Container();
          const halo = this.createGlowSprite();
          const mid = this.createGlowSprite();
          const core = this.createGlowSprite();
          const sparkle = new Sprite(getSparkleTexture());
          sparkle.anchor.set(0.5);
          sparkle.blendMode = 'add';
          root.addChild(halo, mid, sparkle, core);
          this.container.addChild(root);
          glow = {
            root,
            halo,
            mid,
            core,
            sparkle,
            midi,
            x: target.x,
            color: target.color,
            vividColor: lighten(target.color, 0.08),
            alpha: 0,
            targetAlpha: 0,
            phase: Math.random() * Math.PI * 2,
            sparkTimer: 0,
          };
        }
        glow.midi = midi;
        glow.alpha = 0;
        glow.sparkTimer = 0;
        glow.root.visible = true;
        this.sustainedGlows.set(midi, glow);
      }
      glow.targetAlpha = 1;
      glow.x = target.x;
      glow.color = target.color;
      glow.vividColor = lighten(target.color, 0.08);
      glow.halo.tint = glow.vividColor;
      glow.mid.tint = glow.vividColor;
    }

    for (const glow of this.sustainedGlows.values()) {
      if (!active.has(glow.midi)) glow.targetAlpha = 0;
    }

    this.elapsed += dt;
    // Each glow spawns its own dots independently, so a big chord would otherwise multiply the
    // total spawn rate by however many keys are held at once. Stretching the per-glow interval by
    // the number of currently-lit glows keeps the system-wide spark rate roughly constant instead
    // of compounding.
    const spawnInterval = SUSTAIN_SPARK_INTERVAL * Math.max(1, Math.min(6, this.sustainedGlows.size));
    for (const [midi, glow] of this.sustainedGlows) {
      const rate = glow.targetAlpha > glow.alpha ? SUSTAIN_FADE_IN_RATE : SUSTAIN_FADE_OUT_RATE;
      glow.alpha += (glow.targetAlpha - glow.alpha) * Math.min(1, dt * rate);

      if (glow.targetAlpha === 0 && glow.alpha < 0.01) {
        glow.root.visible = false;
        this.sustainedGlows.delete(midi);
        this.sustainGlowPool.push(glow);
        continue;
      }

      this.drawSustainGlow(glow, y);

      // A steady trickle of small dots for as long as the note stays lit —
      // the same "dots" feel as the impact burst's sparks, but continuous.
      if (glow.alpha > 0.2) {
        glow.sparkTimer += dt;
        while (glow.sparkTimer > spawnInterval) {
          glow.sparkTimer -= spawnInterval;
          this.spawnSustainSpark(glow, y);
        }
      }
    }

    this.updateSustainSparks(dt);
  }

  private spawnSustainSpark(glow: SustainGlow, y: number): void {
    let spark = this.sustainSparkPool.pop();
    if (!spark) {
      if (this.sustainSparks.length >= SUSTAIN_SPARK_MAX) {
        const oldest = this.sustainSparks.shift();
        if (oldest) {
          oldest.sprite.visible = false;
          spark = oldest;
        }
      }
      if (!spark) spark = { sprite: this.createSustainSparkSprite(), x: 0, y: 0, vx: 0, vy: 0, age: 0, lifetime: 1 };
    }
    const seed = this.nextSeed++;
    spark.x = glow.x + (hash(seed * 7.13) - 0.5) * 14;
    spark.y = y;
    spark.vx = (hash(seed * 5.31) - 0.5) * 12;
    spark.vy = -(14 + hash(seed * 3.77) * 22);
    spark.age = 0;
    spark.lifetime = 0.5 + hash(seed * 2.14) * 0.4;
    spark.sprite.tint = glow.vividColor;
    spark.sprite.visible = true;
    this.sustainSparks.push(spark);
  }

  private updateSustainSparks(dt: number): void {
    for (let i = this.sustainSparks.length - 1; i >= 0; i--) {
      const s = this.sustainSparks[i] as SustainSpark;
      s.age += dt;
      if (s.age >= s.lifetime) {
        s.sprite.visible = false;
        this.sustainSparks.splice(i, 1);
        this.sustainSparkPool.push(s);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy -= 20 * dt; // a light upward drift that accelerates, like heat rising off the key

      const t = s.age / s.lifetime;
      const fadeIn = Math.min(1, t / 0.15);
      const fadeOut = Math.min(1, (1 - t) / 0.4);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));

      s.sprite.position.set(s.x, s.y);
      s.sprite.alpha = alpha * 0.85;
      const size = 5 + 3 * (1 - t);
      s.sprite.width = size;
      s.sprite.height = size;
    }
  }

  private drawSustainGlow(glow: SustainGlow, y: number): void {
    glow.root.position.set(glow.x, y);

    // A slow, gentle breathing pulse so a held note doesn't look static.
    const pulse = 0.92 + 0.08 * Math.sin(this.elapsed * 3.2 + glow.phase);
    const radius = 20 * pulse;

    glow.halo.alpha = glow.alpha * 0.4;
    glow.halo.width = radius * 3.6;
    glow.halo.height = radius * 3.6;

    glow.mid.alpha = glow.alpha * 0.6;
    glow.mid.width = radius * 1.9;
    glow.mid.height = radius * 1.9;

    glow.core.alpha = glow.alpha * 0.55;
    glow.core.width = radius * 0.85;
    glow.core.height = radius * 0.85;

    // A slow-spinning glint on top for a bit of "shine" instead of a flat glow.
    const sparkleAlpha = glow.alpha * 0.35 * (0.55 + 0.45 * Math.sin(this.elapsed * 1.7 + glow.phase * 1.3));
    glow.sparkle.alpha = Math.max(0, sparkleAlpha);
    glow.sparkle.rotation = this.elapsed * 0.5 + glow.phase;
    glow.sparkle.width = radius * 1.7;
    glow.sparkle.height = radius * 1.7;
  }

  update(dt: number): void {
    for (let i = this.activeBursts.length - 1; i >= 0; i--) {
      const burst = this.activeBursts[i] as Burst;
      burst.elapsed += dt;

      if (burst.elapsed >= BURST_DURATION) {
        burst.active = false;
        burst.root.visible = false;
        this.activeBursts.splice(i, 1);
        this.burstPool.push(burst);
        continue;
      }

      this.drawBurst(burst);
    }
  }

  private drawBurst(burst: Burst): void {
    const t = burst.elapsed / BURST_DURATION;
    const eased = easeOutQuint(t);

    // A big soft color bloom that expands and fades — the "wash" that colors the surrounding area.
    const washFade = Math.max(0, 1 - t * 1.15);
    burst.wash.alpha = washFade * 0.6;
    const washSize = 76 + eased * 190;
    burst.wash.width = washSize;
    burst.wash.height = washSize;

    // A bright white-hot core for the first instant, with a colored halo just behind it.
    const flashAlpha = Math.max(0, 1 - t * 5);
    burst.flashCore.alpha = flashAlpha;
    const coreSize = 26 + eased * 22;
    burst.flashCore.width = coreSize;
    burst.flashCore.height = coreSize;
    burst.flashHalo.alpha = flashAlpha * 0.8;
    const haloSize = 52 + eased * 46;
    burst.flashHalo.width = haloSize;
    burst.flashHalo.height = haloSize;

    // A rotating glint, brightest right at impact, for a bit of "expensive" shine.
    burst.sparkle.alpha = Math.max(0, 1 - t * 2.1) * 0.95;
    burst.sparkle.rotation = eased * 2.6;
    const sparkleSize = 34 + eased * 64;
    burst.sparkle.width = sparkleSize;
    burst.sparkle.height = sparkleSize;

    // Fast inner ripple, smooth deceleration.
    const innerAlpha = Math.max(0, 1 - t * 1.5) * 0.95;
    burst.ringInner.alpha = innerAlpha;
    const innerSize = (16 + eased * 68) * 2;
    burst.ringInner.width = innerSize;
    burst.ringInner.height = innerSize;

    // Slower, wider trailing ripple, colored, for extra intensity.
    const outerT = Math.max(0, t - 0.08);
    const outerEased = easeOutCubic(Math.min(1, outerT / 0.92));
    const outerAlpha = Math.max(0, 1 - outerT * 1.2) * 0.75;
    burst.ringOuter.alpha = outerAlpha;
    const outerSize = (24 + outerEased * 104) * 2;
    burst.ringOuter.width = outerSize;
    burst.ringOuter.height = outerSize;

    // A wide fan of crystalline sparks — glassy shards mixed with soft dots — each with its own
    // angle/speed/size, easing outward and fading.
    for (const spark of burst.sparks) {
      const sparkT = Math.min(1, Math.max(0, (t - spark.lifeOffset) / (1 - spark.lifeOffset)));
      const sparkEased = easeOutCubic(sparkT);
      const sparkAlpha = Math.max(0, 1 - sparkT * 1.1);
      if (sparkAlpha <= 0.02) {
        spark.sprite.visible = false;
        continue;
      }
      spark.sprite.visible = true;

      const dist = sparkEased * spark.speed;
      const sx = Math.cos(spark.angle) * dist;
      const sy = Math.sin(spark.angle) * dist * 0.85 - sparkT * 8; // a touch of extra lift, like real sparks catching air
      const size = Math.max(1, spark.size * (1 - sparkT * 0.55)) * (spark.isShard ? 3.4 : 2.6);

      spark.sprite.position.set(sx, sy);
      spark.sprite.width = size;
      spark.sprite.height = size;
      spark.sprite.alpha = sparkAlpha;
      if (spark.isShard) {
        spark.sprite.rotation = spark.angle + sparkT * 3;
        spark.sprite.tint = 0xffffff;
      } else {
        spark.sprite.tint = burst.vividColor;
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
