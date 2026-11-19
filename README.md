# 3R Manipulator — writing simulation

**Live Vercel app:** https://3r-manipulator-three.vercel.app

## Kinematics (corrected from user-supplied CAD inspection)

The uploaded STL models show three +Z hinge axes:
- Base → Link 1 pivot (x=0 mm)
- Link 1 → Link 2 at Link 1 hole (x≈120 mm)
- Link 2 → Link 3 at Link 2 hole (x≈100 mm)
- **Link 3 pen axis at x≈60 mm**, not 28 mm. Its large center opening is at x≈30 mm.

Joint origin Z estimates: 55, 69, 83 mm; pen tip relative to Link 3 z=-82 mm; down nominally at z=1 mm. Exact physical stepper shaft and pen length must be calibrated.

## Vercel browser app

- No CAD upload prompt. All five provided STL parts are automatically loaded as CAD-derived triangle meshes (decimated and quantized for small download size).
- Enter text (A–Z, 0–9 and basic punctuation), plan each stroke with exact planar 3R inverse kinematics.
- Pen-up / pen-down auxiliary prismatic axis between strokes; blue ink path uses actual rendered pen-tip pose.
- Optional MuJoCo WASM model using `src/writing-scene.xml`, which includes 3 hinge joints, pen-slide axis, actuators, inertias, contact proxy and writing surface.
- Vercel builds Vite and serves the application from the `main` branch.

**CAD fidelity warning:** Browser meshes were generated from the supplied original STL surfaces, reduced through quadric decimation and 0.1 mm vertex quantization. They are approximations of the original triangulations, not validated motor assemblies or collision meshes. Original full-resolution STLs are retained in the conversation bundle; GitHub hosts the lightweight derived assets.

## Local simulation

```bash
pip install mujoco numpy
python scripts/simulate.py --demo
python -m pytest tests/ -q
```

`scene.xml` contains stand-in collision geometries and is self-contained. To render source STLs locally, use the meshes folder in the downloadable bundle.

## Engineering limitations

Simulation targets not validated against a real robot: motor-to-link coupling, bearing depths, actual pen insertion/length, torque and velocity limits, calibration, contact-force sensing, mesh-mesh collisions and clearance. The physical model is a research prototype, **not** a validated assembled robot or handwriting-trained policy. ROS bridge and motor electronics must be integrated separately.
