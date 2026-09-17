"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";

import { COLORS } from "./constants";

/**
 * A field of instanced grass blades.
 *
 * Each blade is five vertices and three triangles, tapering to a point. They
 * are placed once on the CPU and never updated, so the whole field costs one
 * draw call and no per-frame work.
 */

const BLADE_COUNT = 26000;
const FIELD_RADIUS = 52;
/** Blades are skipped inside this box so none poke through the board. */
const BOARD_CLEARANCE = { x: 4.6, z: 1.6 };

/** Lehmer PRNG, so the field is identical on every load. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function bladeGeometry(): THREE.BufferGeometry {
  const width = 0.055;
  const height = 1;

  const positions = new Float32Array([
    // base quad
    -width / 2, 0, 0,
    width / 2, 0, 0,
    width * 0.3, height * 0.55, 0,

    -width / 2, 0, 0,
    width * 0.3, height * 0.55, 0,
    -width * 0.3, height * 0.55, 0,

    // tip
    -width * 0.3, height * 0.55, 0,
    width * 0.3, height * 0.55, 0,
    0, height, 0,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Point every normal straight up rather than along the blade face. A real
  // blade is a thin curved surface; giving them face normals makes half the
  // field turn black as it rotates away from the sun. Upward normals let each
  // blade take the sky and sun evenly, which is the usual trick for grass.
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

  // Darker in the shade at the base, brighter at the tip. This is the
  // attribute `vertexColors` needs; without it the shader multiplies the
  // material colour by an undefined varying and every blade turns black.
  const base = new THREE.Color("#22400f");
  const tipColor = new THREE.Color("#86c04a");
  const colors = new Float32Array(positions.length);
  const blended = new THREE.Color();
  for (let v = 0; v < positions.length / 3; v += 1) {
    const t = positions[v * 3 + 1] / height;
    blended.copy(base).lerp(tipColor, t);
    blended.toArray(colors, v * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geometry;
}

export default function Grass() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => bladeGeometry(), []);

  const { matrices, colors } = useMemo(() => {
    const matrices = new Float32Array(BLADE_COUNT * 16);
    const colors = new Float32Array(BLADE_COUNT * 3);

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const rand = makeRandom(1337);

    let placed = 0;
    while (placed < BLADE_COUNT) {
      // Denser near the board, thinning out toward the horizon.
      const radius = Math.pow(rand(), 0.6) * FIELD_RADIUS;
      const angle = rand() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (Math.abs(x) < BOARD_CLEARANCE.x && Math.abs(z) < BOARD_CLEARANCE.z) {
        continue; // under the board, would clip through the frame
      }
      const i = placed;
      placed += 1;

      dummy.position.set(x, 0, z);
      dummy.rotation.set(
        (rand() - 0.5) * 0.35,
        rand() * Math.PI * 2,
        (rand() - 0.5) * 0.5,
      );
      const height = 0.34 + rand() * 0.46;
      dummy.scale.set(0.85 + rand() * 0.5, height, 1);
      dummy.updateMatrix();
      dummy.matrix.toArray(matrices, i * 16);

      // Multiplied over the blade gradient: a little hue drift per blade and
      // a gentle darkening with distance so the field reads as deep.
      const depth = Math.min(radius / FIELD_RADIUS, 1);
      tint.setRGB(
        0.82 + rand() * 0.3 - depth * 0.12,
        0.85 + rand() * 0.28 - depth * 0.1,
        0.75 + rand() * 0.3 - depth * 0.14,
      );
      tint.toArray(colors, i * 3);
    }

    return { matrices, colors };
  }, []);

  return (
    <group>
      {/* Ground under the blades so gaps never show the void. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[220, 64]} />
        <meshStandardMaterial color={COLORS.ground} roughness={1} />
      </mesh>

      <instancedMesh
        ref={meshRef}
        args={[geometry, undefined, BLADE_COUNT]}
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.9}
        />
        <instancedBufferAttribute
          attach="instanceMatrix"
          args={[matrices, 16]}
        />
        <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      </instancedMesh>
    </group>
  );
}
