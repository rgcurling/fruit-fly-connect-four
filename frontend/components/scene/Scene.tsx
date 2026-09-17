"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";

import { Board, Coord } from "@/lib/types";
import FlyActor from "@/components/FlyActor/FlyActor";
import { FlyMotorRequest } from "@/components/FlyActor/flyStates";
import Board3D from "./Board3D";
import CameraRig from "./CameraRig";
import Chips from "./Chips";
import ColumnPicker from "./ColumnPicker";
import Grass from "./Grass";
import { BOARD_HEIGHT, BOARD_LIFT } from "./constants";

interface SceneProps {
  board: Board;
  lastMove: { row: number; column: number } | null;
  winningCells: Coord[] | null;
  thinking: boolean;
  disabled: boolean;
  onDrop: (column: number) => void;
  /** Decided but unplaced fly move; drives the carry-and-drop sequence. */
  flyMove: FlyMotorRequest | null;
  /** Fired at the frame the fly lets the piece go. */
  onFlyRelease: (column: number) => void;
  /** Short body reaction once a game ends. */
  flyOutcome: "win" | "lose" | null;
  reducedMotion: boolean;
}

/**
 * Look a little above the middle of the board. Aiming lower pinned the top
 * edge near the top of the panel and left the fly nowhere to hover.
 */
const TARGET: [number, number, number] = [0, BOARD_LIFT + BOARD_HEIGHT * 0.55, 0];

export default function Scene({
  board,
  lastMove,
  winningCells,
  thinking,
  disabled,
  onDrop,
  flyMove,
  onFlyRelease,
  flyOutcome,
  reducedMotion,
}: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 11.2, 18.5], fov: 34, near: 0.1, far: 240 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
    >
      {/* Haze that swallows the far grass and keeps the panel dark. */}
      <color attach="background" args={["#16240f"]} />
      <fog attach="fog" args={["#263d18", 42, 130]} />

      {/* Key light, low and warm, throwing the board's shadow across the grass. */}
      <directionalLight
        position={[7, 13, 9]}
        intensity={3.1}
        color="#fff3d9"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0008}
      />
      {/* Cool bounce from the sky, green bounce from the grass. */}
      <hemisphereLight args={["#cfe4ff", "#4a7a2e", 1.45]} />
      <ambientLight intensity={0.42} />
      {/* Cold rim from behind so the blue frame separates from the field. */}
      <directionalLight position={[-9, 5, -7]} intensity={0.7} color="#8fb6ff" />

      <Suspense fallback={null}>
        <Grass />
        <Board3D />
        <Chips
          board={board}
          lastMove={lastMove}
          winningCells={winningCells as [number, number][] | null}
        />
        <ColumnPicker board={board} disabled={disabled} onDrop={onDrop} />
        <FlyActor
          move={flyMove}
          thinking={thinking}
          outcome={flyOutcome}
          onRelease={onFlyRelease}
          reducedMotion={reducedMotion}
        />
      </Suspense>

      <CameraRig target={TARGET} />

      <OrbitControls
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={11}
        maxDistance={40}
        minPolarAngle={0.35}
        maxPolarAngle={1.36}
        minAzimuthAngle={-Math.PI / 2.4}
        maxAzimuthAngle={Math.PI / 2.4}
      />
    </Canvas>
  );
}
