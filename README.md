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


## Pen-contact comparison modes

The simulator has independent **Pen lift** (default; original virtual 12 mm prismatic lift) and **Fixed pen / no lift** modes. Both use the same 3R IK letter trajectories. Fixed mode commands zero pen lift at all points and leaves orange connector marks as the tool drags between strokes; blue is the intended lettering. The top-down preview is a drawing of the planned path, and the 3D view traces the simulated tip. This is **simulation only**: no pen-lift hardware is installed or assumed, and the physical Arduino writing command remains blocked until a lift mechanism is actually fitted and tested.


## Motor installation registered to original STL cavities

A motor placement pass uses the **full-resolution user-supplied STL cross sections**:

| Fixed CAD part | Shaft axis (XY mm) | Two mounting hole centers (XY mm) | Motor support face |
| --- | --- | --- | --- |
| Base_Lid | (0,0) | (-8,-17.5),(-8,+17.5) | underside at z=36mm (base coordinates) |
| Link1 | (120,0) | (112,-17.5),(112,+17.5) | underside at local z=0mm |
| Link2 | (100,0) | (92,-17.5),(92,+17.5) | underside at local z=0mm |

The nominal motor hole spacing is 35 mm, matching common 28BYJ-48 motors.
Link1 / Link2 top-side recesses near x=110/90 mm are not equivalent to a
19 mm-deep motor cavity: the bodies are visualized below the fixed links,
with screw ears aligned to the actual small fixing holes. The 5mm output
shafts are shown attached to downstream rotating joints. Gold sleeve
sections are **conceptual couplers** across existing axial gaps
(base ~9mm; links ~4mm). These couplers and all resulting
clearances, screw compatibility, joint centers, motor torque, and backlash
need physical verification, and have not been validated with motor CAD or
a collision solver. The user STL does not include 28BYJ-48 motor solids.


## CAD link face orientation correction

Original STL link coordinates are kept unchanged in the source data. For the installed model, the visual meshes of Link 1, Link 2, and Link 3 are rotated **180° about the local X axis** and offset +8 mm in local Z. This turns the recessed +Z face toward the motors beneath each supported plate, without flipping the actuated joint coordinate frames. In Link 3, the tall pen-holder boss consequently extends below the local plate. This is a visual assembly orientation hypothesis based on the STL's stepped surfaces; physical motor bodies, mechanical interfaces, and the pen-to-paper height remain subject to fit verification.
