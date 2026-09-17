"use client";

import { useGLTF } from "@react-three/drei";
import { RefObject, useMemo } from "react";
import * as THREE from "three";

/**
 * The FlyBody-derived anatomical fly.
 *
 * Loads `public/models/flybody.glb`, which `tools/flybody/convert_flybody.py`
 * produced from the TuragaLab/flybody MuJoCo model (Apache 2.0). The GLB
 * carries three logical nodes: a static `body`, and `wing_left` / `wing_right`
 * whose geometry is expressed about each wing hinge.
 *
 * This component only assembles and exposes those pivots. All motion comes
 * from `useFlyAnimation`, and none of it is derived from connectome motor
 * output.
 */

export const FLYBODY_URL = "/models/flybody.glb";

interface FlyBodyModelProps {
  wingLeftRef: RefObject<THREE.Object3D | null>;
  wingRightRef: RefObject<THREE.Object3D | null>;
}

interface Assembled {
  body: THREE.Mesh[];
  leftWing: THREE.Mesh[];
  rightWing: THREE.Mesh[];
  leftHinge: THREE.Vector3;
  rightHinge: THREE.Vector3;
}

export default function FlyBodyModel({
  wingLeftRef,
  wingRightRef,
}: FlyBodyModelProps) {
  const gltf = useGLTF(FLYBODY_URL);

  const assembled = useMemo<Assembled>(() => {
    // Cloned so remounting never mutates the cached GLTF.
    const scene = gltf.scene.clone(true);

    const result: Assembled = {
      body: [],
      leftWing: [],
      rightWing: [],
      leftHinge: new THREE.Vector3(),
      rightHinge: new THREE.Vector3(),
    };

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      object.castShadow = true;
      object.receiveShadow = false;
      object.frustumCulled = false;

      const material = object.material as THREE.MeshStandardMaterial;
      if (material) {
        // The wing membrane exports as a translucent blend material; without
        // this it z-fights against the veins behind it.
        if (material.transparent) {
          material.depthWrite = false;
          material.side = THREE.DoubleSide;
        }
        material.envMapIntensity = 0.6;
      }

      const name = object.name;
      if (name.startsWith("wing_left")) {
        // The converter put each wing's pivot in the node translation and made
        // the geometry hinge-relative, so zeroing the offset here and hanging
        // the mesh off a pivot group reproduces the hinge exactly.
        result.leftHinge.copy(object.position);
        object.position.set(0, 0, 0);
        result.leftWing.push(object);
      } else if (name.startsWith("wing_right")) {
        result.rightHinge.copy(object.position);
        object.position.set(0, 0, 0);
        result.rightWing.push(object);
      } else {
        result.body.push(object);
      }
    });

    return result;
  }, [gltf]);

  return (
    <group>
      {assembled.body.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}

      <group ref={wingLeftRef} position={assembled.leftHinge}>
        {assembled.leftWing.map((mesh) => (
          <primitive key={mesh.uuid} object={mesh} />
        ))}
      </group>

      <group ref={wingRightRef} position={assembled.rightHinge}>
        {assembled.rightWing.map((mesh) => (
          <primitive key={mesh.uuid} object={mesh} />
        ))}
      </group>
    </group>
  );
}

useGLTF.preload(FLYBODY_URL);
