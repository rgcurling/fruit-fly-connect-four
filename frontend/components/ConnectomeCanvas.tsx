"use client";

import { useEffect, useRef } from "react";

import { BrainPhase } from "@/lib/types";

/**
 * Canvas point-cloud "connectome".
 *
 * An original, synthetic visualisation: thousands of points arranged into
 * fly-brain-shaped regions, with rim-weighted optic lobe shells, a dense
 * central mass, paired sensory clusters and a descending motor column. It is
 * *not* derived from connectome data. See the caveat under the panel.
 *
 * While the fly is thinking, a scripted wave runs through the regions in
 * order: sensory in, out to the optic lobes, through the central brain, then
 * down the motor column.
 *
 * Rendering notes: points are drawn as small rectangles rather than arcs, and
 * batched by region and brightness bucket, so a frame costs a couple of dozen
 * state changes instead of one per point. Activation is evaluated per region
 * and delay bucket rather than per point for the same reason.
 */

type RegionName = "optic" | "central" | "sensory" | "motor";

const REGIONS: RegionName[] = ["optic", "central", "sensory", "motor"];

const REGION_RGB: Record<RegionName, [number, number, number]> = {
  optic: [56, 189, 248],
  central: [246, 166, 35],
  sensory: [74, 222, 128],
  motor: [251, 59, 83],
};

/** Start and end of each region's activation, as a fraction of one cycle. */
const STAGE_WINDOW: Record<RegionName, [number, number]> = {
  sensory: [0.0, 0.34],
  optic: [0.12, 0.62],
  central: [0.24, 0.84],
  motor: [0.58, 1.0],
};

const POINT_COUNT = 9200;
const CYCLE_MS = 900;
const SETTLE_PER_MS = 1 / 620;

/** Brightness quantisation: more buckets is smoother but costs draw calls. */
const BUCKETS = 7;
/** Propagation is looked up per region and delay bucket, not per point. */
const DELAY_BUCKETS = 8;

const TRACT_COUNT = 150;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cloud {
  x: Float32Array;
  y: Float32Array;
  region: Uint8Array;
  delayBucket: Uint8Array;
  jitter: Float32Array;
  size: Uint8Array;
  tracts: Float32Array;
}

/** The sensory clusters are where activity starts, so delay radiates from here. */
const SOURCE = { x: 0.5, y: 0.63 };

function buildCloud(): Cloud {
  const rng = mulberry32(20260916);

  const xs: number[] = [];
  const ys: number[] = [];
  const regions: number[] = [];
  const sizes: number[] = [];

  const push = (x: number, y: number, region: RegionName, size: number) => {
    xs.push(x);
    ys.push(y);
    regions.push(REGIONS.indexOf(region));
    sizes.push(size);
  };

  // --- Optic lobes -----------------------------------------------------------
  // Shells: denser toward the rim, thinning inward, so they read as curved
  // tissue rather than discs. The outline is modulated per angle, because a
  // clean ellipse reads as a drawn ring instead of an organ.
  //
  // Radii are in normalised units that get multiplied by a box 1.5 times wider
  // than it is tall, so the x radius must be roughly two thirds of the y
  // radius for the lobe to actually look taller than it is wide.
  const opticPerSide = Math.round(POINT_COUNT * 0.2);
  for (let side = -1; side <= 1; side += 2) {
    const cx = 0.5 + side * 0.3;
    const cy = 0.43;
    // Fixed harmonics per side keep the silhouette stable between reloads.
    const warpA = 0.11 + rng() * 0.05;
    const warpB = 0.07 + rng() * 0.04;
    const warpPhase = rng() * Math.PI * 2;

    for (let i = 0; i < opticPerSide; i += 1) {
      const angle = rng() * Math.PI * 2;
      // Bias toward the rim without stacking everything on one contour.
      const radius = Math.pow(rng(), 0.35);
      const outline =
        1 +
        warpA * Math.sin(angle * 2 + warpPhase) +
        warpB * Math.sin(angle * 3 - warpPhase);

      // Soften the edge that faces the midline, where the lobe meets the brain.
      const facingIn = Math.cos(angle) * -side;
      if (facingIn > 0.7 && rng() < (facingIn - 0.7) * 2.4) continue;

      push(
        cx + Math.cos(angle) * 0.1 * radius * outline,
        cy + Math.sin(angle) * 0.2 * radius * outline,
        "optic",
        radius > 0.82 ? 2 : 1,
      );
    }
  }

  // --- Central brain ---------------------------------------------------------
  const centralCount = Math.round(POINT_COUNT * 0.28);
  for (let i = 0; i < centralCount; i += 1) {
    // Two stacked masses give the central brain a waist, like the real thing.
    const upper = rng() < 0.55;
    const cy = upper ? 0.385 : 0.515;
    const ry = upper ? 0.1 : 0.08;
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng());
    push(
      0.5 + Math.cos(angle) * 0.088 * radius,
      cy + Math.sin(angle) * ry * radius,
      "central",
      radius > 0.7 ? 1 : 2,
    );
  }

  // Bridges from each lobe into the central mass. Kept sparse and pinched in
  // the middle, otherwise they render as a hard bar skewering the lobes.
  const bridgeCount = Math.round(POINT_COUNT * 0.03);
  for (let i = 0; i < bridgeCount; i += 1) {
    const side = rng() < 0.5 ? -1 : 1;
    const t = rng();
    const waist = 0.012 + Math.abs(t - 0.5) * 0.05;
    push(
      0.5 + side * (0.13 + t * 0.14),
      0.43 + (rng() - 0.5) * 2 * waist,
      "optic",
      1,
    );
  }

  // --- Sensory clusters ------------------------------------------------------
  const sensoryPerSide = Math.round(POINT_COUNT * 0.07);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < sensoryPerSide; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng());
      push(
        0.5 + side * 0.055 + Math.cos(angle) * 0.035 * radius,
        0.63 + Math.sin(angle) * 0.045 * radius,
        "sensory",
        2,
      );
    }
  }

  // --- Motor column ----------------------------------------------------------
  const motorCount = Math.round(POINT_COUNT * 0.18);
  for (let i = 0; i < motorCount; i += 1) {
    const t = Math.pow(rng(), 0.8);
    const spread = 0.058 * (1 - t * 0.6);
    push(
      0.5 + (rng() - 0.5) * 2 * spread,
      0.7 + t * 0.28,
      "motor",
      t < 0.3 ? 2 : 1,
    );
  }

  // --- Pack ------------------------------------------------------------------
  const count = xs.length;
  const cloud: Cloud = {
    x: new Float32Array(xs),
    y: new Float32Array(ys),
    region: new Uint8Array(regions),
    delayBucket: new Uint8Array(count),
    jitter: new Float32Array(count),
    size: new Uint8Array(sizes),
    tracts: new Float32Array(TRACT_COUNT * 4),
  };

  let maxDistance = 0;
  const distances = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const d = Math.hypot(cloud.x[i] - SOURCE.x, cloud.y[i] - SOURCE.y);
    distances[i] = d;
    if (d > maxDistance) maxDistance = d;
  }
  for (let i = 0; i < count; i += 1) {
    const normalised = distances[i] / (maxDistance || 1);
    cloud.delayBucket[i] = Math.min(
      DELAY_BUCKETS - 1,
      Math.floor(normalised * DELAY_BUCKETS),
    );
    cloud.jitter[i] = rng();
  }

  // Faint long-range tracts, for structure rather than brightness.
  for (let i = 0; i < TRACT_COUNT; i += 1) {
    const a = Math.floor(rng() * count);
    const b = Math.floor(rng() * count);
    cloud.tracts[i * 4] = cloud.x[a];
    cloud.tracts[i * 4 + 1] = cloud.y[a];
    cloud.tracts[i * 4 + 2] = cloud.x[b];
    cloud.tracts[i * 4 + 3] = cloud.y[b];
  }

  return cloud;
}

/** Smooth 0 to 1 to 0 bump across [start, end]. */
function bump(t: number, start: number, end: number): number {
  if (t <= start || t >= end) return 0;
  const p = (t - start) / (end - start);
  return Math.sin(Math.PI * p) ** 0.85;
}

interface ConnectomeCanvasProps {
  phase: BrainPhase;
  className?: string;
}

export default function ConnectomeCanvas({
  phase,
  className = "",
}: ConnectomeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<BrainPhase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const cloud = buildCloud();
    const count = cloud.x.length;

    // Reused scratch buffers: one list of point indices per draw batch.
    const batches: number[][] = [];
    for (let i = 0; i < REGIONS.length * BUCKETS; i += 1) batches.push([]);

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;
    let energy = 0;
    let cycleStart = 0;
    let lastFrame = performance.now();

    // region x delayBucket envelope, recomputed once per frame.
    const envelope = new Float32Array(REGIONS.length * DELAY_BUCKETS);

    const draw = (now: number) => {
      const dt = Math.min(now - lastFrame, 64);
      lastFrame = now;

      const thinking = phaseRef.current === "thinking";
      if (thinking) {
        if (energy === 0) cycleStart = now;
        energy = Math.min(1, energy + dt / 240);
      } else {
        energy = Math.max(0, energy - dt * SETTLE_PER_MS);
      }
      const cycleT = ((now - cycleStart) % CYCLE_MS) / CYCLE_MS;

      // Fit the cloud into the panel with a little breathing room.
      const boxW = Math.min(width * 0.96, height * 1.5);
      const boxH = boxW / 1.5;
      const offsetX = (width - boxW) / 2;
      const offsetY = (height - boxH) / 2;

      ctx.fillStyle = "#04060b";
      ctx.fillRect(0, 0, width, height);

      const bloom = ctx.createRadialGradient(
        width / 2,
        height * 0.46,
        0,
        width / 2,
        height * 0.46,
        boxW * 0.55,
      );
      bloom.addColorStop(0, `rgba(26,58,110,${0.14 + energy * 0.22})`);
      bloom.addColorStop(1, "rgba(4,6,11,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);

      // --- envelopes ---
      const pulse = 0.86 + 0.14 * Math.sin(now * 0.0015);
      for (let r = 0; r < REGIONS.length; r += 1) {
        const [start, end] = STAGE_WINDOW[REGIONS[r]];
        for (let d = 0; d < DELAY_BUCKETS; d += 1) {
          const shifted = cycleT - (d / DELAY_BUCKETS) * 0.09;
          envelope[r * DELAY_BUCKETS + d] =
            energy > 0.001 ? energy * bump(shifted, start, end) : 0;
        }
      }

      ctx.globalCompositeOperation = "lighter";

      // --- tracts ---
      const tractAlpha = 0.025 + energy * 0.07;
      ctx.strokeStyle = `rgba(120,170,235,${tractAlpha.toFixed(3)})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < TRACT_COUNT; i += 1) {
        ctx.moveTo(
          offsetX + cloud.tracts[i * 4] * boxW,
          offsetY + cloud.tracts[i * 4 + 1] * boxH,
        );
        ctx.lineTo(
          offsetX + cloud.tracts[i * 4 + 2] * boxW,
          offsetY + cloud.tracts[i * 4 + 3] * boxH,
        );
      }
      ctx.stroke();

      // --- bucket every point by region and brightness ---
      for (let b = 0; b < batches.length; b += 1) batches[b].length = 0;

      for (let i = 0; i < count; i += 1) {
        const region = cloud.region[i];
        const jitter = cloud.jitter[i];
        const idle = 0.1 + 0.05 * jitter * pulse;
        const env = envelope[region * DELAY_BUCKETS + cloud.delayBucket[i]];

        let value = idle;
        if (env > 0) {
          // Jitter spreads the wave front so it never looks like a hard edge.
          value = idle + env * (0.58 + 0.42 * jitter);
        }
        if (!reduceMotion && env > 0.25 && jitter > 0.995) value = 1.2;

        const bucket = Math.min(BUCKETS - 1, Math.floor(value * BUCKETS));
        batches[region * BUCKETS + bucket].push(i);
      }

      // --- draw, one fill style per batch ---
      for (let region = 0; region < REGIONS.length; region += 1) {
        const [r, g, b] = REGION_RGB[REGIONS[region]];
        for (let bucket = 0; bucket < BUCKETS; bucket += 1) {
          const indices = batches[region * BUCKETS + bucket];
          if (indices.length === 0) continue;

          const level = (bucket + 0.5) / BUCKETS;
          // Capped below 1: additive blending on top of the bloom pass drives
          // the brightest clusters to white and loses the region colour.
          const alpha = Math.min(0.88, 0.15 + level * 0.78);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;

          const scale = level > 0.55 ? 1 : 0;
          for (const i of indices) {
            const size = cloud.size[i] + scale;
            ctx.fillRect(
              offsetX + cloud.x[i] * boxW,
              offsetY + cloud.y[i] * boxH,
              size,
              size,
            );
          }

          // Bloom pass for the brightest points only.
          if (level > 0.78) {
            ctx.fillStyle = `rgba(${r},${g},${b},0.055)`;
            for (const i of indices) {
              ctx.fillRect(
                offsetX + cloud.x[i] * boxW - 2,
                offsetY + cloud.y[i] * boxH - 2,
                6,
                6,
              );
            }
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full ${className}`}
    />
  );
}
