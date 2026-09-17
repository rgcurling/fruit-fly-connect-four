/**
 * Shared types for the Connect Four client.
 *
 * The API types mirror the FastAPI response models exactly. They are the
 * contract that will survive the swap from the placeholder heuristic to a
 * connectome-derived model, so keep them in sync with `backend/main.py`.
 */

export const ROWS = 6;
export const COLS = 7;

/** 1 = human, -1 = fly, 0 = empty. */
export type Player = 1 | -1;
export type Cell = Player | 0;
export type Board = Cell[][];

export const EMPTY = 0 as const;
export const HUMAN = 1 as const;
export const FLY = -1 as const;

/** Coordinates as [row, column]; row 0 is the top of the board. */
export type Coord = [number, number];

export type GameStatus =
  | "your-move"
  | "fly-thinking"
  /** Decision made; the fly's body is carrying the piece to the column. */
  | "fly-moving"
  | "human-win"
  | "fly-win"
  | "draw"
  | "error";

/** Telemetry for one fly "thought". Synthetic in this release. */
export interface Activity {
  neurons_fired: number;
  spikes: number;
  motor_spikes: number;
  sim_time_ms: number;
}

/** Response body of `POST /move`. */
export interface MoveResponse {
  column: number;
  scores: number[];
  activity: Activity;
  model: string;
  notes: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  model: string;
  rows: number;
  cols: number;
}

export interface SessionScore {
  human: number;
  fly: number;
  draws: number;
}

/** Which stage the brain visualisation should render. */
export type BrainPhase = "idle" | "thinking";
