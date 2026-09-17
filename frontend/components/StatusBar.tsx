"use client";

import { findDropRow } from "@/lib/game";
import { STATUS } from "@/lib/status";
import { Board, COLS, GameStatus } from "@/lib/types";

interface StatusBarProps {
  board: Board;
  status: GameStatus;
  error: string | null;
  locked: boolean;
  finished: boolean;
  onDrop: (column: number) => void;
  onNewGame: () => void;
  onRetry: () => void;
}

/**
 * Bottom bar: current state, one line of instruction, and a row of column
 * buttons that give keyboard users a direct way to play without traversing
 * the board itself.
 */
export default function StatusBar({
  board,
  status,
  error,
  locked,
  finished,
  onDrop,
  onNewGame,
  onRetry,
}: StatusBarProps) {
  const presentation = STATUS[status];
  const columns = Array.from({ length: COLS }, (_, i) => i);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-edge/80 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${presentation.dot}`} />
        <span className={`label-caps text-[11px] ${presentation.text}`}>
          {presentation.label}
        </span>
        <span className="truncate text-[12px] text-muted">
          {error ?? presentation.hint}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="label-caps hidden text-[9px] text-muted sm:inline">
          Drop
        </span>
        <div className="flex gap-1">
          {columns.map((column) => {
            const full = findDropRow(board, column) === null;
            const disabled = full || locked || finished;

            return (
              <button
                key={column}
                type="button"
                disabled={disabled}
                onClick={() => onDrop(column)}
                aria-label={`Drop your piece in column ${column + 1}${
                  full ? " (full)" : ""
                }`}
                className="
                  h-8 w-8 rounded-md border border-edge bg-panel-soft font-mono text-[12px]
                  text-dim transition-colors
                  enabled:hover:border-accent/60 enabled:hover:text-accent
                  disabled:cursor-not-allowed disabled:opacity-35
                "
              >
                {column + 1}
              </button>
            );
          })}
        </div>

        {status === "error" && (
          <button
            type="button"
            onClick={onRetry}
            className="
              label-caps rounded-md border border-orange-400/50 bg-orange-400/10 px-3 py-1.5
              text-[10px] text-orange-300 transition-colors hover:bg-orange-400/20
            "
          >
            Retry
          </button>
        )}

        <button
          type="button"
          onClick={onNewGame}
          className="
            label-caps rounded-md border border-edge bg-panel-soft px-3 py-1.5
            text-[10px] text-dim transition-colors hover:border-edge-bright hover:text-slate-200
          "
        >
          New game
        </button>
      </div>
    </div>
  );
}
