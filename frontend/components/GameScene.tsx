"use client";

import dynamic from "next/dynamic";

import { FlyMotorRequest } from "@/components/FlyActor/flyStates";
import { useWebglSupport } from "@/lib/webgl";

import ConnectFourBoard from "@/components/ConnectFourBoard";
import FruitFly from "@/components/FruitFly";
import { Board, Coord } from "@/lib/types";

/**
 * Host for the 3D board.
 *
 * The scene is client-only and pulls in Three.js, so it is loaded on demand.
 * If the browser cannot give us a WebGL context the game still has to be
 * playable, so we fall back to the flat board rather than showing a dead panel.
 */
const Scene = dynamic(() => import("@/components/scene/Scene"), {
  ssr: false,
  loading: () => <SceneSkeleton />,
});

function SceneSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0a1207]">
      <span className="label-caps animate-pulse text-[10px] text-muted">
        Loading scene
      </span>
    </div>
  );
}

interface GameSceneProps {
  board: Board;
  lastMove: { row: number; column: number } | null;
  winningCells: Coord[] | null;
  thinking: boolean;
  disabled: boolean;
  onDrop: (column: number) => void;
  flyMove: FlyMotorRequest | null;
  onFlyRelease: (column: number) => void;
  flyOutcome: "win" | "lose" | null;
  reducedMotion: boolean;
}

export default function GameScene(props: GameSceneProps) {
  const supported = useWebglSupport();

  if (supported === null) return <SceneSkeleton />;

  if (!supported) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="w-full max-w-[32rem]">
          <div className="mb-3 flex items-center justify-center gap-3">
            <FruitFly
              thinking={props.thinking}
              className={`h-10 w-12 shrink-0 ${props.thinking ? "" : "animate-fly-hover"}`}
            />
            <p className="label-caps text-[10px] text-muted">
              3D unavailable, using the flat board
            </p>
          </div>
          <ConnectFourBoard
            board={props.board}
            lastMove={props.lastMove}
            winningCells={props.winningCells}
            disabled={props.disabled}
            onDrop={props.onDrop}
          />
        </div>
      </div>
    );
  }

  return <Scene {...props} />;
}
