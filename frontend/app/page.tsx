"use client";

import { useEffect, useState } from "react";

import BrainActivityPanel from "@/components/BrainActivityPanel";
import GamePanel from "@/components/GamePanel";
import TopNav from "@/components/TopNav";
import { API_BASE_URL, checkHealth } from "@/lib/api";
import { announcement } from "@/lib/status";
import { useConnectFour } from "@/lib/useConnectFour";
import { countPieces } from "@/lib/game";
import { useReducedMotion } from "@/lib/motion";
import { useWebglSupport } from "@/lib/webgl";

export default function Home() {
  const webglSupported = useWebglSupport();
  const reducedMotion = useReducedMotion();
  const game = useConnectFour({ embodied: webglSupported !== false });
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  // One health probe on load so a missing backend is visible before the first
  // move rather than after it.
  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then(() => !cancelled && setBackendUp(true))
      .catch(() => !cancelled && setBackendUp(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const hasStarted = countPieces(game.board) > 0 || game.finished;

  return (
    <>
      <TopNav onNewGame={game.newGame} hasStarted={hasStarted} />

      {/* Status changes are announced without moving focus. */}
      <p aria-live="polite" className="sr-only">
        {announcement(game.status)}
      </p>

      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {backendUp === false && game.status !== "error" && (
          <div
            role="status"
            className="panel border-orange-400/40 bg-orange-400/5 px-4 py-2.5 text-[12px] text-orange-200"
          >
            The fly backend at {API_BASE_URL} is not responding. Start it with{" "}
            <code className="font-mono text-orange-300">
              uvicorn main:app --reload --port 8000
            </code>{" "}
            from the backend directory.
          </div>
        )}

        {/* Desktop: 60/40 split. Mobile: stacked. */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <GamePanel
            board={game.board}
            status={game.status}
            lastMove={game.lastMove}
            winningCells={game.winningCells}
            session={game.session}
            error={game.error}
            locked={game.locked}
            finished={game.finished}
            onDrop={game.play}
            onNewGame={game.newGame}
            onRetry={game.retry}
            flyMove={
              game.pendingFlyMove
                ? { column: game.pendingFlyMove.column }
                : null
            }
            onFlyRelease={game.commitFlyMove}
            flyOutcome={
              game.status === "fly-win"
                ? "win"
                : game.status === "human-win"
                  ? "lose"
                  : null
            }
            reducedMotion={reducedMotion}
          />

          <BrainActivityPanel
            phase={game.status === "fly-thinking" ? "thinking" : "idle"}
            activity={game.activity}
            scores={game.scores}
            flyColumn={game.flyColumn}
            model={game.model}
          />
        </div>

      </main>
    </>
  );
}
