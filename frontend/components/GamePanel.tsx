"use client";

import GameScene from "@/components/GameScene";
import { FlyMotorRequest } from "@/components/FlyActor/flyStates";
import StatusBar from "@/components/StatusBar";
import { STATUS } from "@/lib/status";
import { Board, Coord, GameStatus, SessionScore } from "@/lib/types";

interface GamePanelProps {
  board: Board;
  status: GameStatus;
  lastMove: { row: number; column: number } | null;
  winningCells: Coord[] | null;
  session: SessionScore;
  error: string | null;
  locked: boolean;
  finished: boolean;
  onDrop: (column: number) => void;
  onNewGame: () => void;
  onRetry: () => void;
  flyMove: FlyMotorRequest | null;
  onFlyRelease: (column: number) => void;
  flyOutcome: "win" | "lose" | null;
  reducedMotion: boolean;
}

function ScoreChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="label-caps text-[9px] text-muted">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

/** Full-scene overlay shown when the game ends. */
function WinnerBanner({
  status,
  onNewGame,
}: {
  status: GameStatus;
  onNewGame: () => void;
}) {
  const isWin = status === "human-win";
  const isLoss = status === "fly-win";

  const headline = isWin ? "You win" : isLoss ? "The fly wins" : "Draw";
  const sub = isWin
    ? "Four in a row. The fly did not see it coming."
    : isLoss
      ? "The fly found four in a row."
      : "Board full, no winner.";

  const ring = isWin
    ? "border-emerald-400/50 shadow-[0_0_60px_-12px_rgba(52,211,153,0.6)]"
    : isLoss
      ? "border-chip-fly/50 shadow-[0_0_60px_-12px_rgba(239,68,68,0.6)]"
      : "border-edge-bright shadow-[0_0_60px_-12px_rgba(148,163,184,0.4)]";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
      <div
        className={`animate-rise-in pointer-events-auto rounded-2xl border bg-void/85 px-8 py-6 text-center backdrop-blur-md ${ring}`}
      >
        <p
          className={`text-2xl font-semibold tracking-tight sm:text-3xl ${
            isWin ? "text-emerald-300" : isLoss ? "text-chip-fly" : "text-slate-200"
          }`}
        >
          {headline}
        </p>
        <p className="mt-1 text-[12px] text-dim">{sub}</p>
        <button
          type="button"
          onClick={onNewGame}
          className="
            label-caps mt-4 rounded-md border border-accent/40 bg-accent/10 px-4 py-2
            text-[10px] text-accent transition-colors hover:border-accent/70 hover:bg-accent/20
          "
        >
          New game
        </button>
      </div>
    </div>
  );
}

export default function GamePanel({
  board,
  status,
  lastMove,
  winningCells,
  session,
  error,
  locked,
  finished,
  onDrop,
  onNewGame,
  onRetry,
  flyMove,
  onFlyRelease,
  flyOutcome,
  reducedMotion,
}: GamePanelProps) {
  const thinking = status === "fly-thinking";
  const presentation = STATUS[status];

  return (
    <section
      aria-label="Connect Four game"
      className="panel relative flex h-full flex-col overflow-hidden"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/80 px-4 py-3">
        <h2 className="label-caps text-[10px] text-dim sm:text-[11px]">
          The fly is playing you
        </h2>

        <div className="flex items-center gap-4">
          <ScoreChip label="You" value={session.human} tone="text-chip-human" />
          <ScoreChip label="Fly" value={session.fly} tone="text-chip-fly" />
          <ScoreChip label="Draws" value={session.draws} tone="text-dim" />
          <span className="label-caps hidden text-[9px] text-muted lg:inline">
            placeholder policy
          </span>
        </div>
      </header>

      {/* The scene fills the panel; everything else floats on top of it. */}
      {/*
        On phones the scene gets a fixed slice of the viewport; on desktop it
        takes the remaining panel height.
      */}
      <div className="relative h-[52vh] max-h-[560px] min-h-[300px] lg:h-auto lg:max-h-none lg:min-h-[460px] lg:flex-1">
        <GameScene
          board={board}
          lastMove={lastMove}
          winningCells={winningCells}
          thinking={thinking}
          disabled={locked || finished}
          onDrop={onDrop}
          flyMove={flyMove}
          onFlyRelease={onFlyRelease}
          flyOutcome={flyOutcome}
          reducedMotion={reducedMotion}
        />

        <div
          className={`
            pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2
            rounded-md border border-white/10 bg-black/55 px-3 py-1.5 backdrop-blur-sm
          `}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${presentation.dot}`} />
          <span className={`label-caps text-[10px] ${presentation.text}`}>
            {presentation.label}
          </span>
        </div>

        <p className="pointer-events-none absolute bottom-3 right-4 z-10 rounded-md border border-white/10 bg-black/55 px-2.5 py-1.5 text-[11px] text-dim backdrop-blur-sm">
          drag to orbit · click a column to drop
        </p>

        {finished && <WinnerBanner status={status} onNewGame={onNewGame} />}
      </div>

      <StatusBar
        board={board}
        status={status}
        error={error}
        locked={locked}
        finished={finished}
        onDrop={onDrop}
        onNewGame={onNewGame}
        onRetry={onRetry}
      />
    </section>
  );
}
