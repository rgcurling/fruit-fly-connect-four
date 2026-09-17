"use client";

import { RefObject } from "react";
import * as THREE from "three";

/**
 * Geometry-only fruit fly built from primitives.
 *
 * This is the fallback used when the FlyBody-derived GLB cannot be loaded. It
 * holds no animation of its own: it exposes the same two wing pivots the real
 * model does, so `useFlyAnimation` drives either body identically.
 */

interface PrimitiveFlyProps {
  wingLeftRef: RefObject<THREE.Object3D | null>;
  wingRightRef: RefObject<THREE.Object3D | null>;
}

export default function PrimitiveFly({
  wingLeftRef,
  wingRightRef,
}: PrimitiveFlyProps) {
  return (
    // The shared driver assumes +X is forward, matching the converted GLB.
    <group rotation={[0, Math.PI / 2, 0]} scale={0.62}>
      {/* Abdomen */}
      <mesh position={[0, 0, -0.62]} scale={[0.46, 0.4, 0.78]} castShadow>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color="#6b4a16" roughness={0.55} />
      </mesh>

      {[-0.35, -0.7, -1.02].map((z, i) => (
        <mesh
          key={z}
          position={[0, 0, z]}
          scale={[0.47 - i * 0.03, 0.41 - i * 0.03, 0.05]}
        >
          <sphereGeometry args={[1, 18, 12]} />
          <meshStandardMaterial color="#241703" roughness={0.7} />
        </mesh>
      ))}

      {/* Thorax */}
      <mesh position={[0, 0.04, 0.12]} scale={[0.46, 0.42, 0.5]} castShadow>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color="#9a6b22" roughness={0.5} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.02, 0.62]} scale={[0.34, 0.3, 0.27]} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
        <meshStandardMaterial color="#3b2a0c" roughness={0.6} />
      </mesh>

      {/* Compound eyes */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.24, 0.05, 0.64]}
          scale={[0.24, 0.27, 0.25]}
          castShadow
        >
          <sphereGeometry args={[1, 18, 14]} />
          <meshStandardMaterial
            color="#e0342c"
            roughness={0.22}
            emissive="#7f1d1d"
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}

      {/* Wing pivots, driven by the shared animation hook. */}
      <group ref={wingLeftRef} position={[0.12, 0.22, -0.05]}>
        <mesh position={[0.62, 0, -0.18]} scale={[0.72, 0.03, 0.26]}>
          <sphereGeometry args={[1, 16, 10]} />
          <meshStandardMaterial
            color="#dbeafe"
            transparent
            opacity={0.32}
            roughness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      <group ref={wingRightRef} position={[-0.12, 0.22, -0.05]}>
        <mesh position={[-0.62, 0, -0.18]} scale={[0.72, 0.03, 0.26]}>
          <sphereGeometry args={[1, 16, 10]} />
          <meshStandardMaterial
            color="#dbeafe"
            transparent
            opacity={0.32}
            roughness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Legs */}
      {[
        [0.3, 0.3, -0.2, 0.5],
        [0.3, 0.05, -0.1, 0.9],
        [0.3, -0.2, 0.05, 1.2],
      ].flatMap(([x, z, lean, spin]) =>
        [-1, 1].map((side) => (
          <group
            key={`${x}-${z}-${side}`}
            position={[side * x, -0.2, z]}
            rotation={[lean, side * spin * 0.35, side * 0.5]}
          >
            <mesh position={[0, -0.16, 0]} castShadow>
              <cylinderGeometry args={[0.028, 0.022, 0.34, 6]} />
              <meshStandardMaterial color="#2a1c07" roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.36, 0.1]} rotation={[0.9, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.014, 0.3, 6]} />
              <meshStandardMaterial color="#2a1c07" roughness={0.8} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
