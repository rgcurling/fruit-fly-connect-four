#!/usr/bin/env python3
"""Convert the FlyBody MuJoCo fruit fly into a single browser-ready GLB.

FlyBody (https://github.com/TuragaLab/flybody, Apache-2.0) ships the adult
Drosophila melanogaster body as 85 Wavefront OBJ parts plus a MuJoCo XML that
places them in a kinematic tree and assigns flat materials. MuJoCo is not
something we want in a browser, so this script does the assembly offline:

    fruitfly.xml + 85 OBJ parts  ->  bake rest pose  ->  group by material
                                 ->  decimate        ->  one optimised .glb

What it deliberately does NOT do: any physics. Joints, actuators, tendons and
the fluid model are ignored. The output is anatomy, posed once.

Usage
-----
    python -m venv .venv && ./.venv/bin/pip install -r requirements.txt
    ./.venv/bin/python convert_flybody.py \
        --flybody-root /path/to/flybody \
        --output ../../frontend/public/models/flybody.glb

Run with --report to print the per-material face budget without writing.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import trimesh

# --- Source layout ------------------------------------------------------------

ASSET_SUBPATH = Path("flybody/fruitfly/assets")
MODEL_XML = "fruitfly.xml"

#: MuJoCo geom classes that describe physics volumes rather than anatomy.
COLLISION_CLASSES = {"collision", "collision-membrane", "adhesion-collision"}
#: Materials only ever used by those volumes.
COLLISION_MATERIALS = {"blue", "pink"}

#: Geoms with no explicit material inherit MuJoCo's `body` default class.
DEFAULT_MATERIAL = "body"

# --- Output shape -------------------------------------------------------------

#: Bodies whose geometry becomes its own animatable glTF node. Everything else
#: is merged into one static `body` node.
ARTICULATED: Dict[str, str] = {
    "wing_left": "wing_left",
    "wing_right": "wing_right",
}

#: Face budget per output node. The eyes carry the most detail because the
#: ommatidia are the single most recognisable feature of the animal; the legs
#: and abdomen read fine at a fraction of their source density.
FACE_BUDGET: Dict[str, int] = {
    "body": 44_000,
    "wing_left": 1_200,
    "wing_right": 1_200,
}

#: Per-material floors, applied inside the body budget so no part collapses.
MATERIAL_MIN_FACES: Dict[str, int] = {
    "red": 9_000,      # compound eyes
    "body": 12_000,    # thorax, abdomen, legs
    "black": 2_500,
    "lower": 2_500,
    "brown": 800,
    "ocelli": 400,
    "bristle-brown": 400,
    "membrane": 400,
}

#: Body length in scene units after normalisation.
TARGET_LENGTH = 1.0


# --- Maths --------------------------------------------------------------------


def quat_to_matrix(quat: Sequence[float]) -> np.ndarray:
    """MuJoCo quaternion (w, x, y, z) to a 4x4 homogeneous matrix."""
    w, x, y, z = (float(v) for v in quat)
    norm = math.sqrt(w * w + x * x + y * y + z * z)
    if norm == 0.0:
        return np.eye(4)
    w, x, y, z = w / norm, x / norm, y / norm, z / norm

    matrix = np.eye(4)
    matrix[:3, :3] = np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
        ]
    )
    return matrix


def translation(vec: Sequence[float]) -> np.ndarray:
    matrix = np.eye(4)
    matrix[:3, 3] = np.asarray(vec, dtype=float)
    return matrix


def parse_vec(text: Optional[str], default: Sequence[float]) -> List[float]:
    if not text:
        return list(default)
    return [float(v) for v in text.replace(",", " ").split()]


def local_transform(element: ET.Element) -> np.ndarray:
    """Position and orientation of an element within its parent frame.

    Handles MuJoCo's `quat`, `euler` and `axisangle` spellings. `xyaxes` and
    `zaxis` are not used anywhere in fruitfly.xml, so they raise rather than
    silently producing a wrong pose.
    """
    matrix = translation(parse_vec(element.get("pos"), (0.0, 0.0, 0.0)))

    if element.get("quat"):
        matrix = matrix @ quat_to_matrix(parse_vec(element.get("quat"), (1, 0, 0, 0)))
    elif element.get("euler"):
        angles = parse_vec(element.get("euler"), (0, 0, 0))
        matrix = matrix @ trimesh.transformations.euler_matrix(*angles, "sxyz")
    elif element.get("axisangle"):
        values = parse_vec(element.get("axisangle"), (0, 0, 1, 0))
        matrix = matrix @ trimesh.transformations.rotation_matrix(
            values[3], values[:3]
        )
    elif element.get("xyaxes") or element.get("zaxis"):
        raise NotImplementedError(
            f"element {element.get('name')!r} uses an orientation spelling this "
            "converter does not handle; extend local_transform()"
        )

    return matrix


# --- Model walking ------------------------------------------------------------


@dataclass
class Part:
    """One visual geom, resolved to world space."""

    mesh_name: str
    material: str
    node: str
    matrix: np.ndarray


@dataclass
class Model:
    materials: Dict[str, Dict[str, object]] = field(default_factory=dict)
    meshes: Dict[str, str] = field(default_factory=dict)
    parts: List[Part] = field(default_factory=list)
    mesh_scale: Tuple[float, float, float] = (1.0, 1.0, 1.0)
    #: World position of each articulated node's origin (its hinge).
    node_origins: Dict[str, np.ndarray] = field(default_factory=dict)


def is_visual(geom: ET.Element) -> bool:
    if not geom.get("mesh"):
        return False
    if geom.get("class") in COLLISION_CLASSES:
        return False
    if geom.get("material") in COLLISION_MATERIALS:
        return False
    # group 4 and 5 are MuJoCo's collision display groups.
    if geom.get("group") in {"4", "5"}:
        return False
    return True


def read_model(xml_path: Path) -> Model:
    root = ET.parse(xml_path).getroot()
    model = Model()

    default_mesh = root.find("./default/mesh")
    if default_mesh is not None and default_mesh.get("scale"):
        scale = parse_vec(default_mesh.get("scale"), (1, 1, 1))
        model.mesh_scale = (scale[0], scale[1], scale[2])

    asset = root.find("asset")
    if asset is None:
        raise ValueError("no <asset> block; is this a MuJoCo model?")

    for material in asset.findall("material"):
        name = material.get("name")
        if not name:
            continue
        rgba = parse_vec(material.get("rgba"), (0.8, 0.8, 0.8, 1.0))
        model.materials[name] = {
            "rgba": rgba,
            "shininess": float(material.get("shininess") or 0.5),
            "specular": float(material.get("specular") or 0.5),
        }

    for mesh in asset.findall("mesh"):
        name, file = mesh.get("name"), mesh.get("file")
        if name and file:
            model.meshes[name] = file

    worldbody = root.find("worldbody")
    if worldbody is None:
        raise ValueError("no <worldbody> block")

    def walk(body: ET.Element, parent: np.ndarray, node: str) -> None:
        world = parent @ local_transform(body)

        name = body.get("name") or ""
        if name in ARTICULATED:
            node = ARTICULATED[name]
            model.node_origins[node] = world[:3, 3].copy()

        for geom in body.findall("geom"):
            if not is_visual(geom):
                continue
            model.parts.append(
                Part(
                    mesh_name=geom.get("mesh", ""),
                    material=geom.get("material") or DEFAULT_MATERIAL,
                    node=node,
                    matrix=world @ local_transform(geom),
                )
            )

        for child in body.findall("body"):
            walk(child, world, node)

    for body in worldbody.findall("body"):
        walk(body, np.eye(4), "body")

    return model


# --- Geometry -----------------------------------------------------------------


def load_part(asset_dir: Path, part: Part, model: Model) -> Optional[trimesh.Trimesh]:
    file_name = model.meshes.get(part.mesh_name)
    if not file_name:
        print(f"  ! no file for mesh {part.mesh_name!r}", file=sys.stderr)
        return None

    path = asset_dir / file_name
    if not path.exists():
        print(f"  ! missing {path.name}", file=sys.stderr)
        return None

    mesh = trimesh.load_mesh(path, process=False)
    if not isinstance(mesh, trimesh.Trimesh):
        mesh = trimesh.util.concatenate(list(mesh.geometry.values()))

    # MuJoCo applies the asset-level mesh scale before placing the geom.
    mesh.apply_scale(model.mesh_scale)
    mesh.apply_transform(part.matrix)
    # The OBJs are triangle soup: welding cuts the vertex count by about 3x and
    # is what makes smooth normals possible.
    mesh.merge_vertices()
    return mesh


def decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    """Quadric edge-collapse down to roughly `target_faces`."""
    if len(mesh.faces) <= target_faces:
        return mesh

    import fast_simplification

    ratio = 1.0 - (target_faces / len(mesh.faces))
    vertices, faces = fast_simplification.simplify(
        mesh.vertices.astype(np.float32),
        mesh.faces.astype(np.int32),
        target_reduction=float(min(max(ratio, 0.0), 0.98)),
    )
    return trimesh.Trimesh(vertices=vertices, faces=faces, process=False)


def allocate_budget(
    face_counts: Dict[str, int], budget: int
) -> Dict[str, int]:
    """Split a node's face budget across its materials.

    Proportional to source density, but never below each material's floor, so
    decimating the body never erases the ocelli or the wing veins.
    """
    floors = {
        name: min(MATERIAL_MIN_FACES.get(name, 300), count)
        for name, count in face_counts.items()
    }
    reserved = sum(floors.values())
    remaining = max(budget - reserved, 0)
    total = sum(face_counts.values()) or 1

    allocation: Dict[str, int] = {}
    for name, count in face_counts.items():
        share = int(remaining * (count / total))
        allocation[name] = min(count, floors[name] + share)
    return allocation


def pbr_material(name: str, spec: Dict[str, object]) -> trimesh.visual.material.PBRMaterial:
    """Map a flat MuJoCo material onto glTF metallic-roughness."""
    rgba = list(spec["rgba"])  # type: ignore[index]
    shininess = float(spec["shininess"])  # type: ignore[arg-type]

    # MuJoCo shininess is a Phong exponent scaler; glTF wants roughness.
    roughness = float(np.clip(1.0 - 0.85 * shininess, 0.08, 1.0))
    base = [float(np.clip(c, 0.0, 1.0)) for c in rgba[:3]] + [
        float(np.clip(rgba[3] if len(rgba) > 3 else 1.0, 0.0, 1.0))
    ]

    return trimesh.visual.material.PBRMaterial(
        name=name,
        baseColorFactor=base,
        metallicFactor=0.0,
        roughnessFactor=roughness,
        doubleSided=name == "membrane",
        alphaMode="BLEND" if base[3] < 1.0 else "OPAQUE",
    )


# --- Assembly -----------------------------------------------------------------


def build(asset_dir: Path, report_only: bool = False) -> Tuple[trimesh.Scene, dict]:
    model = read_model(asset_dir / MODEL_XML)
    print(f"  materials: {len(model.materials)}  meshes: {len(model.meshes)}")
    print(f"  visual geoms: {len(model.parts)}  mesh scale: {model.mesh_scale[0]}")

    # node -> material -> merged mesh
    grouped: Dict[str, Dict[str, List[trimesh.Trimesh]]] = {}
    for part in model.parts:
        mesh = load_part(asset_dir, part, model)
        if mesh is None or len(mesh.faces) == 0:
            continue
        grouped.setdefault(part.node, {}).setdefault(part.material, []).append(mesh)

    merged: Dict[str, Dict[str, trimesh.Trimesh]] = {}
    for node, by_material in grouped.items():
        merged[node] = {}
        for material, meshes in by_material.items():
            merged[node][material] = trimesh.util.concatenate(meshes)

    stats: dict = {"nodes": {}, "source_faces": 0, "output_faces": 0}

    # Normalisation: fit the whole animal into TARGET_LENGTH, Y-up, centred.
    everything = trimesh.util.concatenate(
        [m for node in merged.values() for m in node.values()]
    )
    extents = everything.bounds
    span = float(np.max(extents[1] - extents[0]))
    scale = TARGET_LENGTH / span if span else 1.0
    centre = (extents[0] + extents[1]) / 2.0

    # MuJoCo is Z-up with +X forward; glTF is Y-up. Rotate -90 deg about X.
    to_y_up = trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0])
    normalise = to_y_up @ trimesh.transformations.scale_matrix(scale) @ translation(
        -centre
    )

    scene = trimesh.Scene()

    for node, by_material in merged.items():
        face_counts = {name: len(m.faces) for name, m in by_material.items()}
        budget = FACE_BUDGET.get(node, 20_000)
        allocation = allocate_budget(face_counts, budget)

        node_stats = {"materials": {}, "source_faces": 0, "output_faces": 0}

        # Articulated nodes get their geometry expressed about their hinge, so
        # the browser can rotate them in place.
        origin = model.node_origins.get(node)
        hinge = np.eye(4)
        if origin is not None:
            hinge = translation(-origin)

        for material, mesh in by_material.items():
            source = len(mesh.faces)
            simplified = decimate(mesh, allocation[material])

            simplified.apply_transform(hinge)
            simplified.apply_transform(normalise)
            # Recomputed after decimation so lighting stays smooth.
            simplified.fix_normals()

            spec = model.materials.get(material, {"rgba": [0.7, 0.7, 0.7, 1.0], "shininess": 0.5, "specular": 0.5})
            simplified.visual = trimesh.visual.TextureVisuals(
                material=pbr_material(material, spec)
            )

            geom_name = f"{node}__{material}"
            if not report_only:
                node_transform = np.eye(4)
                if origin is not None:
                    node_transform = normalise @ translation(origin) @ np.linalg.inv(
                        normalise
                    )
                scene.add_geometry(
                    simplified,
                    geom_name=geom_name,
                    node_name=geom_name,
                    parent_node_name=None,
                    transform=node_transform,
                )

            node_stats["materials"][material] = {
                "source_faces": source,
                "output_faces": len(simplified.faces),
            }
            node_stats["source_faces"] += source
            node_stats["output_faces"] += len(simplified.faces)

        stats["nodes"][node] = node_stats
        stats["source_faces"] += node_stats["source_faces"]
        stats["output_faces"] += node_stats["output_faces"]

    stats["scale_applied"] = scale
    stats["hinges"] = {
        node: (normalise @ np.append(origin, 1.0))[:3].tolist()
        for node, origin in model.node_origins.items()
    }
    return scene, stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--flybody-root",
        required=True,
        type=Path,
        help="Checkout of https://github.com/TuragaLab/flybody",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("../../frontend/public/models/flybody.glb"),
    )
    parser.add_argument("--report", action="store_true", help="Do not write the GLB")
    args = parser.parse_args()

    asset_dir = (args.flybody_root / ASSET_SUBPATH).resolve()
    if not (asset_dir / MODEL_XML).exists():
        print(f"error: {asset_dir/MODEL_XML} not found", file=sys.stderr)
        print("Clone FlyBody first:", file=sys.stderr)
        print("  git clone --depth 1 https://github.com/TuragaLab/flybody", file=sys.stderr)
        return 1

    print(f"Reading FlyBody from {asset_dir}")
    scene, stats = build(asset_dir, report_only=args.report)

    print(f"\n  source faces: {stats['source_faces']:,}")
    print(f"  output faces: {stats['output_faces']:,}")
    for node, node_stats in stats["nodes"].items():
        print(f"  {node}: {node_stats['output_faces']:,} faces")
        for material, counts in sorted(node_stats["materials"].items()):
            print(
                f"      {material:<16} {counts['source_faces']:>7,} -> "
                f"{counts['output_faces']:>7,}"
            )

    if args.report:
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(trimesh.exchange.gltf.export_glb(scene))
    size = args.output.stat().st_size

    stats_path = args.output.with_suffix(".stats.json")
    stats_path.write_text(json.dumps(stats, indent=2))

    print(f"\nWrote {args.output} ({size/1024/1024:.2f} MB)")
    print(f"Wrote {stats_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
