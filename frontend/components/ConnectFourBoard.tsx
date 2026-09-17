"use client";

import { useState } from "react";

import { findDropRow, isInLine } from "@/lib/game";
import { Board, Cell, Coord, EMPTY, HUMAN } from "@/lib/types";

interface ConnectFourBoardProps {
  board: Board;
  /** Column the last chip landed in, used to animate only that chip. */
  lastMove: { row: number; column: number } | null;
  winningCells: Coord[] | null;
  /** Blocks all input while the fly thinks or the game is over. */
  disabled: boolean;
  onDrop: (column: number) => void;
}

const COLUMN_LABELS = [1, 2, 3, 4, 5, 6, 7];

function chipClasses(cell: Cell): string {
  if (cell === HUMAN) {
    return "bg-[radial-gradient(circle_at_32%_28%,#fde68a_0%,#fbbf24_45%,#b45309_100%)] shadow-[0_2px_10px_rgba(251,191,36,0.45),inset_0_-3px_6px_rgba(120,53,15,0.55)]";
  }
  return "bg-[radial-gradient(circle_at_32%_28%,#fca5a5_0%,#ef4444_45%,#7f1d1d_100%)] shadow-[0_2px_10px_rgba(239,68,68,0.45),inset_0_-3px_6px_rgba(127,29,29,0.6)]";
}

export default function ConnectFourBoard({
  board,
  lastMove,
  winningCells,
  disabled,
  onDrop,
}: ConnectFourBoardProps) {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  return (
    <div className="relative w-full">
      {/* Cobalt frame. */}
      <div
        className="
          relative rounded-2xl border border-cobalt-bright/25
          bg-[linear-gradient(160deg,#1e40af_0%,#152f86_42%,#0a1740_100%)]
          p-2.5 sm:p-3.5
          shadow-[0_28px_70px_-28px_rgba(30,64,175,0.85),inset_0_1px_0_rgba(147,197,253,0.35)]
        "
      >
        {/* Sheen across the top of the frame. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(to_bottom,rgba(191,219,254,0.18),transparent_38%)]"
        />

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {COLUMN_LABELS.map((label, column) => {
            const landingRow = findDropRow(board, column);
            const columnFull = landingRow === null;
            const interactive = !disabled && !columnFull;
            const isHovered = hoveredColumn === column && interactive;

            return (
              <button
                key={label}
                type="button"
                disabled={!interactive}
                aria-label={`Drop your piece in column ${label}${
                  columnFull ? " (full)" : ""
                }`}
                onClick={() => interactive && onDrop(column)}
                onMouseEnter={() => setHoveredColumn(column)}
                onMouseLeave={() => setHoveredColumn(null)}
                onFocus={() => setHoveredColumn(column)}
                onBlur={() => setHoveredColumn(null)}
                className={`
                  group relative flex flex-col gap-1.5 sm:gap-2.5 rounded-xl p-1
                  transition-colors duration-150
                  ${interactive ? "cursor-pointer hover:bg-white/[0.07]" : "cursor-not-allowed"}
                  ${isHovered ? "bg-white/[0.07]" : ""}
                  disabled:cursor-not-allowed
                `}
              >
                {/* Column indicator above the board. */}
                <span
                  aria-hidden
                  className={`
                    pointer-events-none absolute -top-5 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full
                    bg-chip-human transition-opacity duration-150
                    ${isHovered ? "opacity-90 shadow-[0_0_12px_2px_rgba(251,191,36,0.75)]" : "opacity-0"}
                  `}
                />

                {board.map((row, rowIndex) => {
                  const cell = row[column];
                  const isGhost =
                    isHovered && cell === EMPTY && rowIndex === landingRow;
                  const isLast =
                    lastMove?.row === rowIndex && lastMove?.column === column;
                  const isWinning = isInLine(winningCells, rowIndex, column);

                  return (
                    <span
                      key={rowIndex}
                      className="
                        relative block aspect-square w-full rounded-full
                        bg-[radial-gradient(circle_at_50%_38%,#050a18_0%,#0a1330_60%,#101d44_100%)]
                        shadow-[inset_0_3px_7px_rgba(0,0,0,0.85),inset_0_-1px_0_rgba(147,197,253,0.16)]
                      "
                    >
                      {cell !== EMPTY && (
                        <span
                          style={
                            isLast
                              ? ({
                                  "--drop-from": `-${(rowIndex + 1) * 112}%`,
                                } as React.CSSProperties)
                              : undefined
                          }
                          className={`
                            absolute inset-[7%] rounded-full
                            ${chipClasses(cell)}
                            ${isLast ? "animate-chip-drop" : ""}
                            ${isWinning ? "animate-win-pulse z-10" : ""}
                          `}
                        />
                      )}

                      {isGhost && (
                        <span
                          aria-hidden
                          className="absolute inset-[16%] rounded-full border-2 border-dashed border-chip-human/70 bg-chip-human/10"
                        />
                      )}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Column numbers beneath the board. */}
      <div
        aria-hidden
        className="mt-2 grid grid-cols-7 gap-1.5 px-2.5 sm:gap-2.5 sm:px-3.5"
      >
        {COLUMN_LABELS.map((label, column) => (
          <span
            key={label}
            className={`text-center font-mono text-[11px] transition-colors ${
              hoveredColumn === column ? "text-accent" : "text-muted"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
