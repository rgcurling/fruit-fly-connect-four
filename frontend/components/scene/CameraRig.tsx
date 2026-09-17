"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import {
  BOARD_HEIGHT,
  BOARD_LIFT,
  BOARD_WIDTH,
} from "./constants";

/**
 * Keeps the whole board in frame at any aspect ratio.
 *
 * A fixed camera distance that frames the board on a wide desktop panel crops
 * it badly on a phone, where the canvas is close to square. This computes the
 * distance the board actually needs from the camera's field of view and the
 * current canvas aspect, then slides the camera along its existing direction
 * so the player's orbit angle is preserved.
 */

/** What has to stay visible: the frame plus room for the hovering fly. */
const NEEDED_WIDTH = BOARD_WIDTH + 1.7;
const NEEDED_HEIGHT = BOARD_HEIGHT + BOARD_LIFT + 2.5;
/** A little air around the subject. */
const MARGIN = 1.16;

interface CameraRigProps {
  target: [number, number, number];
}

export default function CameraRig({ target }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as
    | { update: () => void }
    | null;

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const aspect = size.width / Math.max(size.height, 1);
    const halfFov = Math.tan((camera.fov * Math.PI) / 360);
    const forWidth = NEEDED_WIDTH / (2 * halfFov * aspect);
    const forHeight = NEEDED_HEIGHT / (2 * halfFov);
    const distance = Math.max(forWidth, forHeight) * MARGIN;

    const focus = new THREE.Vector3(...target);
    const direction = camera.position.clone().sub(focus);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0.42, 1);
    direction.normalize().multiplyScalar(distance);

    camera.position.copy(focus).add(direction);
    camera.updateProjectionMatrix();
    controls?.update();
  }, [camera, size, controls, target]);

  return null;
}
