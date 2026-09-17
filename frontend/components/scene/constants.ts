/**
 * Shared geometry for the 3D scene.
 *
 * One unit is one board cell. Everything else is derived from these so the
 * board, the chips, the hit boxes and the camera never drift apart.
 */

import { COLS, ROWS } from "@/lib/types";

/** Distance between cell centres. */
export const CELL = 1;
/** Radius of a hole in the board face. */
export const HOLE_RADIUS = 0.4;
/** Border of blue plastic around the playable grid. */
export const FRAME_PAD = 0.45;

export const BOARD_WIDTH = COLS * CELL + FRAME_PAD * 2;
export const BOARD_HEIGHT = ROWS * CELL + FRAME_PAD * 2;
export const BOARD_DEPTH = 0.5;

/** How far the bottom edge of the frame sits above the ground. */
export const BOARD_LIFT = 0.42;

export const CHIP_RADIUS = 0.38;
export const CHIP_THICKNESS = 0.3;

export const COLORS = {
  frame: "#1b45b4",
  frameBack: "#0a1b4d",
  human: "#f2b705",
  fly: "#d92b2b",
  ground: "#3f6b2a",
};

/** Cell centre in board-local space. Row 0 is the top row. */
export function cellPosition(row: number, column: number): [number, number] {
  const x = (column - (COLS - 1) / 2) * CELL;
  const y = FRAME_PAD + CELL / 2 + (ROWS - 1 - row) * CELL;
  return [x, y];
}

/** Cell centre in world space. */
export function cellWorldPosition(row: number, column: number): [number, number] {
  const [x, y] = cellPosition(row, column);
  return [x, y + BOARD_LIFT];
}

/**
 * Y coordinate a dropping chip starts from.
 *
 * This is also exactly where the fly releases the piece it carries, so a chip
 * dropped by the fly and a chip spawned by the board begin their fall from the
 * same height and the handover is seamless.
 */
export const DROP_START_Y = BOARD_LIFT + BOARD_HEIGHT + 0.75;

/** How far above the carried piece the fly's body sits. */
export const CARRY_OFFSET_Y = 0.62;

/** Height the fly hovers at while lining up a drop. */
export const HOVER_Y = DROP_START_Y + CARRY_OFFSET_Y;

/**
 * Where the fly waits between turns: beyond the far edge of the board, out
 * over the grass, facing the player.
 */
export const FLY_REST_POSITION: [number, number, number] = [
  2.0,
  BOARD_LIFT + BOARD_HEIGHT + 0.55,
  -4.4,
];

/**
 * World-space hover point above each column, derived from the same board
 * geometry the holes are cut from. Nothing about the fly's flight path is a
 * magic number: move the board and these follow.
 */
export const COLUMN_ANCHORS: [number, number, number][] = Array.from(
  { length: COLS },
  (_, column) => {
    const [x] = cellPosition(0, column);
    return [x, HOVER_Y, 0] as [number, number, number];
  },
);

/** Hover point above `column`, clamped so a bad index cannot throw. */
export function columnAnchor(column: number): [number, number, number] {
  const index = Math.min(Math.max(Math.round(column), 0), COLS - 1);
  return COLUMN_ANCHORS[index];
}
