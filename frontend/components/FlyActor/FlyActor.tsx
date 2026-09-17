"use client";

import { Component, ReactNode, Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

import {
  CHIP_RADIUS,
  CHIP_THICKNESS,
  COLORS,
} from "@/components/scene/constants";
import FlyBodyModel from "./FlyBodyModel";
import PrimitiveFly from "./PrimitiveFly";
import { FlyMotorRequest } from "./flyStates";
import { useFlyAnimation } from "./useFlyAnimation";

/**
 * The embodied fly opponent.
 *
 * Owns the body, its wing pivots and the red piece it carries. The game layer
 * hands it a chosen column through `move` and is told, via `onRelease`, the
 * single frame at which the board should take ownership of the piece.
 *
 * Scientific note: the motion here is authored animation. The game policy
 * chooses the column; this component performs a corresponding embodied
 * sequence. Nothing in this file is derived from connectome motor output.
 */

/** Wingspan of the GLB is 1.0 unit; this sizes it against the board. */
const FLY_SCALE = 2.45;

interface FlyActorProps {
  /**
   * The decided-but-unplaced move. A new object starts a new sequence, so the
   * game's pending-move state can be handed straight in.
   */
  move: FlyMotorRequest | null;
  /** Ambient state between turns. */
  thinking: boolean;
  /** Short reaction when a game ends. */
  outcome: "win" | "lose" | null;
  /** Fired once, when the carried piece is let go. */
  onRelease: (column: number) => void;
  reducedMotion: boolean;
}

/**
 * Keeps a failed model load from taking the game down with it.
 *
 * A missing or corrupt GLB is a cosmetic problem, so it is caught here and the
 * primitive fly is rendered instead. The game never blocks on it.
 */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(
      "[FlyActor] FlyBody model unavailable, using the primitive fly instead.",
      error,
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function FlyActor({
  move,
  thinking,
  outcome,
  onRelease,
  reducedMotion,
}: FlyActorProps) {
  // The component owns the scene objects; the hook owns the behaviour.
  const groupRef = useRef<THREE.Group | null>(null);
  const wingLeftRef = useRef<THREE.Object3D | null>(null);
  const wingRightRef = useRef<THREE.Object3D | null>(null);
  const carriedRef = useRef<THREE.Object3D | null>(null);

  const fly = useFlyAnimation({
    groupRef,
    wingLeftRef,
    wingRightRef,
    carriedRef,
    onRelease,
    reducedMotion,
  });

  // Compared by identity: the game stores one object per decided move, so a
  // re-render never replays and a repeat of the same column still triggers.
  const playedMove = useRef<FlyMotorRequest | null>(null);
  useEffect(() => {
    if (move === playedMove.current) return;
    playedMove.current = move;
    if (move) {
      fly.play(move);
    } else {
      // Cleared without a release: a new game was started mid-flight.
      fly.cancel();
    }
  }, [move, fly]);

  useEffect(() => {
    fly.setResting(thinking ? "thinking" : "idle");
  }, [thinking, fly]);

  const lastOutcome = useRef<string | null>(null);
  useEffect(() => {
    if (outcome === lastOutcome.current) return;
    lastOutcome.current = outcome;
    if (outcome) fly.react(outcome);
  }, [outcome, fly]);

  return (
    // The driven group is unscaled: the carried piece hangs off it at board
    // scale, while only the body is sized up to read against the board.
    <group ref={groupRef}>
      <group scale={FLY_SCALE}>
        <ModelBoundary
          fallback={
            <PrimitiveFly
              wingLeftRef={wingLeftRef}
              wingRightRef={wingRightRef}
            />
          }
        >
          <Suspense
            fallback={
              <PrimitiveFly
                wingLeftRef={wingLeftRef}
                wingRightRef={wingRightRef}
              />
            }
          >
            <FlyBodyModel
              wingLeftRef={wingLeftRef}
              wingRightRef={wingRightRef}
            />
          </Suspense>
        </ModelBoundary>
      </group>

      {/*
        The piece in transit. It exists only between pickup and release; the
        board owns every other red chip, so exactly one is ever visible.
        Scaled out of the actor's own scale so it matches the board's chips.
      */}
      <group ref={carriedRef} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry
            args={[CHIP_RADIUS, CHIP_RADIUS, CHIP_THICKNESS, 30]}
          />
          <meshStandardMaterial
            color={COLORS.fly}
            roughness={0.3}
            metalness={0.08}
          />
        </mesh>
      </group>
    </group>
  );
}
