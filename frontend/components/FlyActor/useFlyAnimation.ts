"use client";

import { useFrame } from "@react-three/fiber";
import { RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  CARRY_OFFSET_Y,
  FLY_REST_POSITION,
  columnAnchor,
} from "@/components/scene/constants";
import {
  FlyMoveInput,
  FlyPhase,
  TimedPhase,
  carriesPiece,
  clamp01,
  easeInOutSine,
  easeOutCubic,
  phaseDurations,
  smootherstep,
  toMotorRequest,
  wingSpeed,
} from "./flyStates";

/**
 * Drives the fly's transform every frame.
 *
 * The caller owns the objects; this hook owns the behaviour. All mutable
 * animation state lives in one lazily created store that is only ever touched
 * from callbacks and the frame loop, never during render, so a whole move
 * sequence costs zero React re-renders.
 */

export interface FlyRefs {
  groupRef: RefObject<THREE.Group | null>;
  wingLeftRef: RefObject<THREE.Object3D | null>;
  wingRightRef: RefObject<THREE.Object3D | null>;
  carriedRef: RefObject<THREE.Object3D | null>;
}

export interface FlyAnimationOptions extends FlyRefs {
  /** Called once, at the exact frame the carried piece is let go. */
  onRelease?: (column: number) => void;
  /** Called when the fly is back at rest and idle again. */
  onSettled?: () => void;
  reducedMotion?: boolean;
}

export interface FlyController {
  /** Start the carry-and-drop sequence for a chosen column. */
  play: (input: FlyMoveInput) => void;
  /** Ambient state when no sequence is running. */
  setResting: (phase: Extract<FlyPhase, "idle" | "thinking">) => void;
  /** Short reaction once a game ends. */
  react: (outcome: "win" | "lose") => void;
  /** Abandon any sequence and drop straight back to the ambient state. */
  cancel: () => void;
  /** True while a move sequence is in flight. */
  isBusy: () => boolean;
}

interface Store {
  phase: FlyPhase;
  resting: Extract<FlyPhase, "idle" | "thinking">;
  elapsed: number;
  queue: TimedPhase[];
  column: number;
  released: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  control: THREE.Vector3;
  /** Smoothed heading and roll, so the body turns rather than snaps. */
  heading: number;
  bank: number;
  rest: THREE.Vector3;
  position: THREE.Vector3;
  previous: THREE.Vector3;
  scratchA: THREE.Vector3;
  scratchB: THREE.Vector3;
  onRelease?: (column: number) => void;
  onSettled?: () => void;
}

/** How far the travel arc bulges up and toward the player. */
const ARC_LIFT = 0.28;
const ARC_TOWARD_CAMERA = 0.9;

/** The model faces +X; the player sits at +Z. */
const RESTING_HEADING = -Math.PI / 2;

function createStore(): Store {
  const rest = new THREE.Vector3(...FLY_REST_POSITION);
  return {
    phase: "idle",
    resting: "idle",
    elapsed: 0,
    queue: [],
    column: 3,
    released: false,
    from: rest.clone(),
    to: rest.clone(),
    control: rest.clone(),
    heading: RESTING_HEADING,
    bank: 0,
    rest,
    position: rest.clone(),
    previous: rest.clone(),
    scratchA: new THREE.Vector3(),
    scratchB: new THREE.Vector3(),
  };
}

export function useFlyAnimation(options: FlyAnimationOptions): FlyController {
  const {
    groupRef,
    wingLeftRef,
    wingRightRef,
    carriedRef,
    onRelease,
    onSettled,
    reducedMotion = false,
  } = options;

  const storeRef = useRef<Store | null>(null);
  const getStore = useCallback((): Store => {
    if (!storeRef.current) storeRef.current = createStore();
    return storeRef.current;
  }, []);

  // Callbacks go in through an effect so a re-rendered parent never restarts
  // the frame loop or loses an in-flight sequence.
  useEffect(() => {
    const store = getStore();
    store.onRelease = onRelease;
    store.onSettled = onSettled;
  }, [getStore, onRelease, onSettled]);

  /** Set up the leg of the flight the given phase represents. */
  const enterPhase = useCallback(
    (phase: FlyPhase) => {
      const store = getStore();
      store.phase = phase;
      store.elapsed = 0;

      const current = groupRef.current?.position;
      if (current) store.from.copy(current);

      if (phase === "travel") {
        store.to.set(...columnAnchor(store.column));
      } else if (phase === "return") {
        store.to.copy(store.rest);
      } else {
        store.to.copy(store.from);
      }

      // Quadratic control point: lift a little and swing toward the player, so
      // the path curves instead of running along a straight line.
      store.control.copy(store.from).add(store.to).multiplyScalar(0.5);
      store.control.y = Math.max(store.from.y, store.to.y) + ARC_LIFT;
      store.control.z += ARC_TOWARD_CAMERA;
    },
    [getStore, groupRef],
  );

  const advance = useCallback(() => {
    const store = getStore();
    const next = store.queue.shift();

    if (!next) {
      store.phase = store.resting;
      store.elapsed = 0;
      store.onSettled?.();
      return;
    }
    enterPhase(next);
  }, [enterPhase, getStore]);

  const play = useCallback(
    (input: FlyMoveInput) => {
      const request = toMotorRequest(input);
      const store = getStore();

      store.column = request.column;
      store.released = false;
      store.queue = ["travel", "hover", "release", "return"];
      enterPhase("pickup");
    },
    [enterPhase, getStore],
  );

  const setResting = useCallback(
    (phase: Extract<FlyPhase, "idle" | "thinking">) => {
      const store = getStore();
      store.resting = phase;
      // Only takes effect immediately when nothing else is playing.
      if (store.phase === "idle" || store.phase === "thinking") {
        store.phase = phase;
      }
    },
    [getStore],
  );

  const react = useCallback(
    (outcome: "win" | "lose") => {
      const store = getStore();
      // Reacting interrupts the flight home, so queue the trip back after it.
      store.queue = ["return"];
      store.released = true;
      enterPhase(outcome);
    },
    [enterPhase, getStore],
  );

  const cancel = useCallback(() => {
    const store = getStore();
    store.queue = [];
    store.released = true;
    store.phase = store.resting;
    store.elapsed = 0;
    if (carriedRef.current) carriedRef.current.visible = false;
  }, [carriedRef, getStore]);

  const isBusy = useCallback(() => {
    const phase = getStore().phase;
    return phase !== "idle" && phase !== "thinking";
  }, [getStore]);

  useFrame((frameState, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const store = getStore();
    const durations = phaseDurations(reducedMotion);
    const time = frameState.clock.getElapsedTime();
    const dt = Math.min(delta, 0.064) * 1000;

    store.previous.copy(group.position);

    // --- position by phase ---
    const duration = durations[store.phase as TimedPhase] ?? 0;
    if (duration > 0) {
      store.elapsed += dt;
      const t = clamp01(store.elapsed / duration);

      if (store.phase === "travel" || store.phase === "return") {
        // Quadratic Bezier along the arc set up in enterPhase.
        const eased = smootherstep(t);
        const inverse = 1 - eased;
        store.position
          .copy(store.scratchA.copy(store.from).multiplyScalar(inverse * inverse))
          .add(
            store.scratchB
              .copy(store.control)
              .multiplyScalar(2 * inverse * eased),
          )
          .add(store.scratchA.copy(store.to).multiplyScalar(eased * eased));
      } else if (store.phase === "win") {
        // A short rise and settle, not a victory lap.
        const eased = easeInOutSine(Math.sin(t * Math.PI));
        store.position.copy(store.rest);
        store.position.y += eased * 1.1;
      } else if (store.phase === "lose") {
        const eased = easeOutCubic(Math.sin(t * Math.PI));
        store.position.copy(store.rest);
        store.position.y -= eased * 0.55;
      } else {
        store.position.copy(store.from);
      }

      if (store.phase === "release" && !store.released) {
        store.released = true;
        store.onRelease?.(store.column);
      }

      if (t >= 1) advance();
    } else {
      store.position.copy(store.rest);
    }

    // --- ambient life ---
    // Idle drift is the only thing running between turns, and it is
    // deliberately small: the brain panel carries the "thinking" signal.
    if (!reducedMotion) {
      const busy = store.phase !== "idle" && store.phase !== "thinking";
      const amplitude = busy ? 0.35 : 1;
      const alert = store.phase === "thinking" ? 0.55 : 1;

      store.position.x += Math.sin(time * 0.7) * 0.34 * amplitude * alert;
      store.position.y +=
        (Math.sin(time * 1.35) * 0.14 + Math.sin(time * 0.43) * 0.07) *
        amplitude;
      store.position.z += Math.sin(time * 0.52) * 0.24 * amplitude * alert;
    }

    group.position.copy(store.position);

    // --- orientation ---
    // Face the direction of travel and bank into it, both smoothed.
    const vx = group.position.x - store.previous.x;
    const vz = group.position.z - store.previous.z;
    const speed = Math.hypot(vx, vz);

    const targetHeading =
      speed > 0.0015 ? Math.atan2(vx, vz) - Math.PI : RESTING_HEADING;

    // Shortest path across the +/-PI seam.
    let difference = targetHeading - store.heading;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    store.heading += difference * Math.min(1, dt / 160);

    const targetBank = reducedMotion
      ? 0
      : THREE.MathUtils.clamp(vx * 5.5, -0.42, 0.42);
    store.bank += (targetBank - store.bank) * Math.min(1, dt / 130);

    group.rotation.set(
      reducedMotion ? -0.18 : -0.3 + Math.sin(time * 0.9) * 0.04,
      store.heading,
      store.bank,
    );

    // --- wings ---
    const beat = Math.sin(time * wingSpeed(store.phase, reducedMotion));
    const sweep = reducedMotion ? 0.18 : 0.62;
    if (wingLeftRef.current) wingLeftRef.current.rotation.x = beat * sweep;
    if (wingRightRef.current) wingRightRef.current.rotation.x = -beat * sweep;

    // --- carried piece ---
    if (carriedRef.current) {
      const shouldCarry = carriesPiece(store.phase);
      carriedRef.current.visible = shouldCarry;
      if (shouldCarry) {
        // Hangs beneath the body and inherits its tilt, the way a carried
        // object should. The disc's own facing is baked into the mesh.
        carriedRef.current.position.set(0, -CARRY_OFFSET_Y, 0);
      }
    }
  });

  return useMemo(
    () => ({ play, setResting, react, cancel, isBusy }),
    [play, setResting, react, cancel, isBusy],
  );
}
