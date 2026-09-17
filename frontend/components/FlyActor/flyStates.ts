/**
 * The fly's body state machine.
 *
 * This module knows nothing about Connect Four strategy and nothing about the
 * model that picks moves. It receives a chosen column and describes how a body
 * should behave in response. That separation is the point: the decision layer
 * can be swapped for a connectome-derived policy without touching any of this.
 */

export type FlyPhase =
  | "idle"
  | "thinking"
  | "pickup"
  | "travel"
  | "hover"
  | "release"
  | "return"
  | "win"
  | "lose";

/**
 * What the body is asked to perform.
 *
 * Today the decision layer only supplies `column`. The extra fields are the
 * forward-compatible slots: when a FlyWire-constrained model is wired in it can
 * pass its activity and motor state through here, and the body can modulate
 * wingbeat, hesitation and path confidence from real signals instead of
 * constants. Nothing reads them yet.
 */
export interface FlyMotorRequest {
  /** Board column, 0 to 6. The only field currently used. */
  column: number;
  /** Reserved: per-region activation from the model. */
  neuralActivity?: number[];
  /** Reserved: descending/motor neuron state. */
  motorState?: Record<string, number>;
  /** Reserved: how strongly the policy preferred this column, 0 to 1. */
  confidence?: number;
}

/** A bare column number is accepted as shorthand for `{ column }`. */
export type FlyMoveInput = number | FlyMotorRequest;

export function toMotorRequest(input: FlyMoveInput): FlyMotorRequest {
  return typeof input === "number" ? { column: input } : input;
}

/** Phases that run on a timer, in the order a move sequence visits them. */
export const MOVE_SEQUENCE: FlyPhase[] = [
  "pickup",
  "travel",
  "hover",
  "release",
  "return",
];

export type TimedPhase = Exclude<FlyPhase, "idle" | "thinking">;

/** Phase durations in milliseconds. */
export const PHASE_MS: Record<TimedPhase, number> = {
  pickup: 420,
  travel: 1020,
  hover: 340,
  release: 140,
  return: 940,
  win: 1500,
  lose: 1250,
};

/**
 * Reduced-motion timings.
 *
 * The sequence still runs, because the player has to be able to see which
 * column the fly chose, but it is short and direct rather than a flight.
 */
export const PHASE_MS_REDUCED: Record<TimedPhase, number> = {
  pickup: 120,
  travel: 340,
  hover: 120,
  release: 100,
  return: 300,
  win: 400,
  lose: 400,
};

export function phaseDurations(reducedMotion: boolean): Record<TimedPhase, number> {
  return reducedMotion ? PHASE_MS_REDUCED : PHASE_MS;
}

/** True while the fly is carrying a piece and it should be visible. */
export function carriesPiece(phase: FlyPhase): boolean {
  return phase === "pickup" || phase === "travel" || phase === "hover";
}

/** Wingbeat frequency in rad/s of phase advance, per state. */
export function wingSpeed(phase: FlyPhase, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  switch (phase) {
    case "travel":
      return 78;
    case "pickup":
    case "hover":
    case "release":
      return 66;
    case "thinking":
      return 60;
    case "win":
      return 74;
    case "lose":
      return 38;
    default:
      return 46;
  }
}

// --- Easing -------------------------------------------------------------------

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Smooth acceleration and deceleration. The workhorse for travel. */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - clamp01(t)) ** 3;
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}
