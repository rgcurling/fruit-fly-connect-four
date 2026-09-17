"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, requestFlyMove } from "./api";
import { checkWinner, createBoard, dropPiece, isDraw, winningLine } from "./game";
import {
  Activity,
  Board,
  Coord,
  FLY,
  GameStatus,
  HUMAN,
  SessionScore,
} from "./types";

/**
 * The fly answers in single-digit milliseconds, which feels like nothing
 * happened. Hold the "thinking" state long enough for the brain panel to run
 * its activation sequence.
 */
const MIN_THINK_MS = 550;
const MAX_THINK_MS = 950;

interface LastMove {
  row: number;
  column: number;
}

/**
 * A fly move that has been decided but not yet placed on the board.
 *
 * While this is set, the board does not contain the fly's chip: the only red
 * piece in the scene is the one the fly is carrying. `commitFlyMove` is what
 * hands ownership over, and it is called at the single frame the fly lets go.
 */
export interface PendingFlyMove {
  column: number;
  row: number;
  board: Board;
  line: Coord[] | null;
  outcome: "fly-win" | "draw" | null;
}

export interface ConnectFourState {
  board: Board;
  status: GameStatus;
  lastMove: LastMove | null;
  winningCells: Coord[] | null;
  activity: Activity | null;
  scores: number[] | null;
  /** Column the fly picked last, highlighted in the score list. */
  flyColumn: number | null;
  model: string | null;
  session: SessionScore;
  error: string | null;
  /** Decided, travelling with the fly, not yet on the board. */
  pendingFlyMove: PendingFlyMove | null;
  /** True while the human must not be able to click. */
  locked: boolean;
  /** True once the game has ended for any reason. */
  finished: boolean;
}

export interface ConnectFourApi extends ConnectFourState {
  play: (column: number) => void;
  newGame: () => void;
  retry: () => void;
  /** Hand the carried piece to the board. Safe to call more than once. */
  commitFlyMove: () => void;
}

export interface ConnectFourOptions {
  /**
   * When true, a decided fly move waits for `commitFlyMove` so the body can
   * carry the piece there first. When false — no WebGL, flat board — the move
   * lands as soon as it is decided.
   */
  embodied?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function initialState(): ConnectFourState {
  return {
    board: createBoard(),
    status: "your-move",
    lastMove: null,
    winningCells: null,
    activity: null,
    scores: null,
    flyColumn: null,
    model: null,
    pendingFlyMove: null,
    session: { human: 0, fly: 0, draws: 0 },
    error: null,
    locked: false,
    finished: false,
  };
}

export function useConnectFour(
  options: ConnectFourOptions = {},
): ConnectFourApi {
  const { embodied = false } = options;
  const [state, setState] = useState<ConnectFourState>(initialState);

  /** Guards against double-submits from fast clicks or held keys. */
  const busyRef = useRef(false);
  /**
   * Latest state, readable from event handlers. Turn logic runs here rather
   * than inside a state updater, because updaters must stay pure: React runs
   * them twice in development Strict Mode, which would make the fly move twice.
   */
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  /** Board the fly still owes us a move for, kept so a failure can be retried. */
  const pendingBoardRef = useRef<Board | null>(null);

  const finishGame = useCallback(
    (board: Board, lastMove: LastMove, line: Coord[] | null, status: GameStatus) => {
      setState((prev) => ({
        ...prev,
        board,
        lastMove,
        winningCells: line,
        status,
        locked: false,
        finished: true,
        error: null,
        session: {
          human: prev.session.human + (status === "human-win" ? 1 : 0),
          fly: prev.session.fly + (status === "fly-win" ? 1 : 0),
          draws: prev.session.draws + (status === "draw" ? 1 : 0),
        },
      }));
    },
    [],
  );

  const runFlyTurn = useCallback(
    async (board: Board) => {
      pendingBoardRef.current = board;
      busyRef.current = true;
      setState((prev) => ({
        ...prev,
        status: "fly-thinking",
        locked: true,
        error: null,
      }));

      const thinkFor = MIN_THINK_MS + Math.random() * (MAX_THINK_MS - MIN_THINK_MS);

      try {
        // Ask the backend and hold the animation at the same time, so the
        // brain panel always gets a full activation sequence.
        const [result] = await Promise.all([requestFlyMove(board), sleep(thinkFor)]);

        const drop = dropPiece(board, result.column, FLY);
        if (!drop) {
          throw new ApiError(
            `The fly chose column ${result.column + 1}, which is already full.`,
          );
        }

        const move = { row: drop.row, column: result.column };
        const line = winningLine(drop.board);
        const shared = {
          activity: result.activity,
          scores: result.scores,
          flyColumn: result.column,
          model: result.model,
        };

        const outcome: PendingFlyMove["outcome"] =
          checkWinner(drop.board) === FLY
            ? "fly-win"
            : isDraw(drop.board)
              ? "draw"
              : null;

        if (embodied) {
          // The decision is done, so the telemetry lands now. The chip does
          // not: the fly has to carry it there first, and `commitFlyMove`
          // finishes the turn.
          setState((prev) => ({
            ...prev,
            ...shared,
            status: "fly-moving",
            locked: true,
            error: null,
            pendingFlyMove: {
              column: result.column,
              row: drop.row,
              board: drop.board,
              line,
              outcome,
            },
          }));
          pendingBoardRef.current = null;
          return;
        }

        if (outcome === "fly-win") {
          setState((prev) => ({ ...prev, ...shared }));
          finishGame(drop.board, move, line, "fly-win");
        } else if (outcome === "draw") {
          setState((prev) => ({ ...prev, ...shared }));
          finishGame(drop.board, move, null, "draw");
        } else {
          setState((prev) => ({
            ...prev,
            ...shared,
            board: drop.board,
            lastMove: move,
            status: "your-move",
            locked: false,
            error: null,
          }));
        }
        pendingBoardRef.current = null;
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : "Something went wrong while contacting the fly.";
        setState((prev) => ({
          ...prev,
          status: "error",
          locked: true,
          error: message,
        }));
      } finally {
        busyRef.current = false;
      }
    },
    [embodied, finishGame],
  );

  const play = useCallback(
    (column: number) => {
      const prev = stateRef.current;
      if (busyRef.current || prev.locked || prev.finished) return;
      if (prev.status !== "your-move") return;
      if (prev.pendingFlyMove) return;

      const drop = dropPiece(prev.board, column, HUMAN);
      if (!drop) return; // illegal click: ignore it

      // Lock before any await so a fast second click cannot slip through.
      busyRef.current = true;

      const move = { row: drop.row, column };
      const line = winningLine(drop.board);

      if (checkWinner(drop.board) === HUMAN) {
        busyRef.current = false;
        finishGame(drop.board, move, line, "human-win");
        return;
      }

      if (isDraw(drop.board)) {
        busyRef.current = false;
        finishGame(drop.board, move, null, "draw");
        return;
      }

      setState((current) => ({
        ...current,
        board: drop.board,
        lastMove: move,
        status: "fly-thinking",
        locked: true,
      }));

      void runFlyTurn(drop.board);
    },
    [finishGame, runFlyTurn],
  );

  /**
   * Hand the carried piece to the board.
   *
   * Called by the fly actor at the frame it releases. Idempotent: a second
   * call with nothing pending does nothing, so a replayed animation or a
   * remount can never place two chips.
   */
  const commitFlyMove = useCallback(() => {
    const pending = stateRef.current.pendingFlyMove;
    if (!pending) return;

    const move = { row: pending.row, column: pending.column };

    if (pending.outcome === "fly-win") {
      setState((prev) => ({ ...prev, pendingFlyMove: null }));
      finishGame(pending.board, move, pending.line, "fly-win");
      return;
    }
    if (pending.outcome === "draw") {
      setState((prev) => ({ ...prev, pendingFlyMove: null }));
      finishGame(pending.board, move, null, "draw");
      return;
    }

    setState((prev) => ({
      ...prev,
      board: pending.board,
      lastMove: move,
      pendingFlyMove: null,
      status: "your-move",
      locked: false,
      error: null,
    }));
  }, [finishGame]);

  const newGame = useCallback(() => {
    busyRef.current = false;
    pendingBoardRef.current = null;
    setState((prev) => ({
      ...initialState(),
      // Session counters survive a restart; everything else resets.
      session: prev.session,
      model: prev.model,
    }));
  }, []);

  const retry = useCallback(() => {
    const board = pendingBoardRef.current;
    if (!board || busyRef.current) return;
    void runFlyTurn(board);
  }, [runFlyTurn]);

  return { ...state, play, newGame, retry, commitFlyMove };
}
