/**
 * Client-side mirror of the Connect Four rules.
 *
 * The backend owns the canonical rules (and is the only thing that decides the
 * fly's move), but the UI needs instant, synchronous answers for hover states,
 * chip landings and win detection. These functions are intentionally a direct
 * translation of `backend/game/logic.py`; the backend test-suite is the
 * authority if the two ever disagree.
 */

import {
  Board,
  Cell,
  COLS,
  Coord,
  EMPTY,
  Player,
  ROWS,
} from "./types";

const CONNECT = 4;

/** Horizontal, vertical, and both diagonals. */
const DIRECTIONS: Coord[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => EMPTY as Cell),
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/** Columns that still have room, left to right. */
export function getLegalMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let c = 0; c < COLS; c += 1) {
    if (board[0][c] === EMPTY) moves.push(c);
  }
  return moves;
}

export function isLegalMove(board: Board, column: number): boolean {
  return column >= 0 && column < COLS && board[0][column] === EMPTY;
}

/** Row a piece would land in, or `null` when the column is full. */
export function findDropRow(board: Board, column: number): number | null {
  if (column < 0 || column >= COLS) return null;
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (board[r][column] === EMPTY) return r;
  }
  return null;
}

export interface DropResult {
  board: Board;
  row: number;
}

/**
 * Drop a piece without mutating `board`.
 * Returns `null` if the move is illegal, so callers can ignore stray clicks.
 */
export function dropPiece(
  board: Board,
  column: number,
  player: Player,
): DropResult | null {
  const row = findDropRow(board, column);
  if (row === null) return null;

  const next = cloneBoard(board);
  next[row][column] = player;
  return { board: next, row };
}

/** The four cells of the first winning line found, or `null`. */
export function winningLine(board: Board): Coord[] | null {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const player = board[r][c];
      if (player === EMPTY) continue;

      for (const [dr, dc] of DIRECTIONS) {
        const endR = r + dr * (CONNECT - 1);
        const endC = c + dc * (CONNECT - 1);
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;

        const cells: Coord[] = [];
        let matches = true;
        for (let i = 0; i < CONNECT; i += 1) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (board[rr][cc] !== player) {
            matches = false;
            break;
          }
          cells.push([rr, cc]);
        }
        if (matches) return cells;
      }
    }
  }
  return null;
}

export function checkWinner(board: Board): Player | null {
  const line = winningLine(board);
  if (!line) return null;
  const [r, c] = line[0];
  return board[r][c] as Player;
}

export function boardIsFull(board: Board): boolean {
  return board[0].every((cell) => cell !== EMPTY);
}

export function isDraw(board: Board): boolean {
  return boardIsFull(board) && checkWinner(board) === null;
}

export function countPieces(board: Board): number {
  return board.flat().filter((cell) => cell !== EMPTY).length;
}

/** `true` when a coordinate is part of the supplied winning line. */
export function isInLine(line: Coord[] | null, row: number, col: number): boolean {
  if (!line) return false;
  return line.some(([r, c]) => r === row && c === col);
}
