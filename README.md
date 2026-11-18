# 3R Manipulator — ROS 2 + MuJoCo

This project models a 3-revolute-joint planar drawing robot using five STL CAD parts: Base Ring, Base Lid, Link 1, Link 2, and Link 3 / Pen Holder.

## Preliminary geometry (from uploaded STL meshes)
- Base ring: 154 x 140 x 36 mm
- Base lid: 154 x 140 x 7 mm
- Link 1: ~150 x 48 x 8 mm; **candidate** joint spacing 120 mm
- Link 2: ~130 x 48 x 8 mm; **candidate** joint spacing 100 mm
- Link 3 pen holder: ~90 x 32 x 22 mm; pen-hole center near local x=28 mm

## First-pass kinematic model

base → J1 (vertical yaw) → link1 → J2 (vertical yaw) → link2 → J3 (vertical yaw) → link3 → pen.

All link meshes were exported with their length roughly along local +X; proposed hinge axes are +Z. Base-to-J1 height 55 mm, link-to-link Z offsets 14 mm each. **These transforms are provisional and must be verified against actual stepper shafts, motor brackets, bearings, and assembly pictures.** STL files do not encode mating constraints.

## Ready-to-run implementation

A complete downloadable project bundle was generated in the ChatGPT conversation, including:
- `scene.xml`: MuJoCo MJCF with stepper-like position actuators, three hinges, mesh visuals and pen-tip site
- `robot.urdf`: matching ROS 2 robot description
- `ros2/`: self-contained ament_python package publishing `/joint_states` and `/pen_tip_pose`, accepting `/joint_commands`
- `scripts/simulate.py`: viewer/headless runner
- `scripts/kinematics.py`: planar 3R forward/inverse kinematics
- `tests/test_static.py`: structural sanity checks
- `meshes/`: the five source STL geometries

The simulation files and binaries are in the bundle; they have **not yet been committed to this GitHub repository**.

## Future writing

The arm is planar, so it can follow XY paths with a vertical pen at a fixed height. Add pen lift, collision/clearance validation, stepper resolution/driver dynamics, trajectory control, and calibration before real writing.

## Status

- CAD envelopes inspected
- Initial joint hierarchy and provisional transforms established
- XML and kinematics static checks passed locally
- MuJoCo runtime and physical fit **not verified**
