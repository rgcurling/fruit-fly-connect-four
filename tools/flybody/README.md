# FlyBody → GLB conversion

One-time, offline conversion of the [TuragaLab/flybody](https://github.com/TuragaLab/flybody)
fruit fly into a single browser-ready `.glb`.

The browser needs **none** of MuJoCo, Python, TensorFlow, Acme or the FlyBody
runtime. It loads one file.

## What FlyBody provides

FlyBody is an anatomically-detailed MuJoCo model of the adult *Drosophila
melanogaster*, from the Turaga Lab at HHMI Janelia Research Campus together
with Google DeepMind. The body ships as:

- `flybody/fruitfly/assets/fruitfly.xml` — the MuJoCo model. It defines the
  kinematic tree (where each body part sits), the per-geom mesh offsets, a flat
  material table, and a global mesh scale of 0.1.
- `flybody/fruitfly/assets/*.obj` — 85 Wavefront meshes, one per anatomical
  part, named by part and material: `head_body`, `head_red` (the compound
  eyes), `thorax_black`, `wing_left_membrane`, `femur_T2_left_body` and so on.

The meshes are plain geometry with no textures, no UVs and no skinning, which
is what makes them straightforward to reuse outside MuJoCo.

## What the converter does

```
fruitfly.xml + 85 OBJ parts
        │
        ├─ walk the kinematic tree, bake each geom to world space at the
        │  model's default (rest) pose
        ├─ skip MuJoCo collision volumes (classes collision,
        │  collision-membrane, adhesion-collision) — those are physics, not
        │  anatomy
        ├─ group by material and concatenate
        ├─ decimate with quadric edge collapse, under a per-material floor so
        │  no part disappears
        ├─ split the wings into their own nodes, with geometry expressed about
        │  each wing hinge so the browser can rotate them
        ├─ convert MuJoCo Z-up to glTF Y-up, recentre, normalise scale
        └─ map flat MuJoCo materials to glTF PBR metallic-roughness
        │
   flybody.glb
```

No physics is carried across. Joints, actuators, tendons, adhesion and the
fluid model are all ignored. The output is anatomy, posed once.

## Running it

```bash
git clone --depth 1 https://github.com/TuragaLab/flybody /tmp/flybody

cd tools/flybody
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python convert_flybody.py \
    --flybody-root /tmp/flybody \
    --output ../../frontend/public/models/flybody.glb
```

`--report` prints the face budget without writing anything.

The checked-in `frontend/public/models/flybody.glb` is the output of exactly
this command. `flybody.stats.json` beside it records the per-material face
counts and the wing hinge positions.

## Result

| | |
|---|---|
| Source faces | 272,550 |
| Output faces | 48,289 |
| GLB size | 874 KB |
| Materials | 8 |
| Nodes | `body`, `wing_left`, `wing_right` |
| Textures | none, flat PBR colours only |

Per-material budgets live in `FACE_BUDGET` and `MATERIAL_MIN_FACES` in
`convert_flybody.py`. The compound eyes keep the largest share (12,753 faces)
because the ommatidia are the most recognisable feature of the animal; the
abdomen and legs read fine at a fraction of their source density.

Model orientation after conversion: **+X is forward** (the head), **+Y is up**,
wingspan runs along **Z**. The largest extent (the wingspan) is normalised to
1.0 scene unit.

## Licence and attribution

FlyBody is licensed **Apache 2.0**. `frontend/public/models/LICENSE-flybody.txt`
carries the upstream licence and the notice of modification, and it ships
alongside the converted asset.

The converted GLB is a modified derivative: the geometry has been re-posed,
merged, decimated and re-materialised as described above. Attribution:

> Fly body geometry derived from [TuragaLab/flybody](https://github.com/TuragaLab/flybody)
> (Apache 2.0), an anatomically-detailed MuJoCo model of *Drosophila
> melanogaster* by the Turaga Lab, HHMI Janelia Research Campus, with Google
> DeepMind. Geometry modified for real-time browser rendering.

## What is *not* vendored

Only the converted GLB lives in this repository. The FlyBody source checkout,
its Python package, its tasks and agents, the `.msh` binary meshes and
`blender_model/drosophila.blend` are not copied here. Clone upstream to
re-run the conversion.
