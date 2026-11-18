# 3R Manipulator — ROS 2 + MuJoCo

[Interactive joint explorer](https://lalitkumar790.github.io/3R-manipulator/) (GitHub Pages; requires Pages to be enabled)

**This is a preliminary, uncalibrated planar 3R arm model.** Uploaded CAD STL files establish the overall shapes, but no assembly mates or stepper shaft positions are supplied; all pivots are provisional.

## Joint tree

Base Ring + Base Lid (fixed) → J1 Z → Link 1 (120 mm) → J2 Z → Link 2 (100 mm) → J3 Z → Link 3 / Pen Holder (28 mm to pen). The base joint is at z=55 mm; link-to-link offsets are 14 mm each.

## Local MuJoCo

The original STL meshes must be copied to `meshes/` (and `ros2/meshes/` for the ROS package). **Mesh binaries are not yet uploaded in this repository; download the complete STL-inclusive project ZIP from the ChatGPT conversation.** Expected names: `base_ring.stl`, `base_lid.stl`, `link1.stl`, `link2.stl`, `link3_penholder.stl`.

```bash
pip install mujoco numpy
python scripts/simulate.py --demo
python scripts/simulate.py --headless --seconds 5 --demo
python scripts/kinematics.py
```

## ROS 2

```bash
mkdir -p ~/three_r_ws/src
cp -r ros2 ~/three_r_ws/src/three_r_sim
cd ~/three_r_ws
colcon build --symlink-install
source install/setup.bash
ros2 run three_r_sim three_r_bridge
```

Subscribe to `/joint_states` and `/pen_tip_pose`. Send `/joint_commands` as `sensor_msgs/msg/JointState` with `name: [joint1, joint2, joint3]` and `position` in radians.

## Scope and limitations

GitHub Pages runs only a browser-based kinematics visualization, **not the actual MuJoCo dynamics simulator or ROS 2**. Native simulation requires Python + MuJoCo; ROS 2 bridge requires ROS 2. Physical mating faces, motor mounts, collision, torque sizing and pen tip Z remain unverified. Writing will additionally require pen lift / contact control.
