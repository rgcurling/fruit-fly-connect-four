"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { COLS, ROWS } from "@/lib/types";
import {
  BOARD_DEPTH,
  BOARD_HEIGHT,
  BOARD_LIFT,
  BOARD_WIDTH,
  COLORS,
  HOLE_RADIUS,
  cellPosition,
} from "./constants";

/**
 * The blue frame.
 *
 * One extruded shape with forty-two circular holes punched through it, which
 * is exactly how the real toy is moulded. Three.js does the hole cutting
 * natively, so there is no CSG dependency and the bevel gives every hole a lip
 * that catches the light.
 */
function useFrameGeometry(): THREE.ExtrudeGeometry {
  return useMemo(() => {
    const shape = new THREE.Shape();
    const w = BOARD_WIDTH;
    const h = BOARD_HEIGHT;
    const r = 0.35;

    shape.moveTo(-w / 2 + r, 0);
    shape.lineTo(w / 2 - r, 0);
    shape.quadraticCurveTo(w / 2, 0, w / 2, r);
    shape.lineTo(w / 2, h - r);
    shape.quadraticCurveTo(w / 2, h, w / 2 - r, h);
    shape.lineTo(-w / 2 + r, h);
    shape.quadraticCurveTo(-w / 2, h, -w / 2, h - r);
    shape.lineTo(-w / 2, r);
    shape.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLS; column += 1) {
        const [x, y] = cellPosition(row, column);
        const hole = new THREE.Path();
        hole.absarc(x, y, HOLE_RADIUS, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: BOARD_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.045,
      bevelSegments: 2,
      curveSegments: 22,
    });
    // Extrusion runs from z=0 forward; centre it on the board plane.
    geometry.translate(0, 0, -BOARD_DEPTH / 2);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

export default function Board3D() {
  const frame = useFrameGeometry();

  return (
    <group position={[0, BOARD_LIFT, 0]}>
      <mesh geometry={frame} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={COLORS.frame}
          roughness={0.28}
          metalness={0.02}
          clearcoat={0.65}
          clearcoatRoughness={0.25}
        />
      </mesh>

      {/* Dark back wall so empty holes read as wells rather than windows. */}
      <mesh position={[0, BOARD_HEIGHT / 2, -BOARD_DEPTH / 2 - 0.04]} receiveShadow>
        <planeGeometry args={[BOARD_WIDTH, BOARD_HEIGHT]} />
        <meshStandardMaterial color={COLORS.frameBack} roughness={0.9} />
      </mesh>

      {/* Two feet, as on the real set. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (BOARD_WIDTH / 2 - 0.85), -BOARD_LIFT + 0.22, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.1, 0.44, 2.1]} />
          <meshStandardMaterial
            color={COLORS.frame}
            roughness={0.38}
            metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  );
}
