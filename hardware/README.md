# Three ULN2003 drivers + Arduino Uno

**Driver-specific firmware:** `hardware/arduino_uno/three_r_uno/three_r_uno.ino`.

Assumes **three 5 V 28BYJ-48 four-phase unipolar geared steppers**, one per ULN2003 board. A ULN2003 module is not a STEP/DIR driver: it needs **four coil control inputs per motor**.

## Wiring

| Board | IN1 | IN2 | IN3 | IN4 | Motor |
|---|---:|---:|---:|---:|---|
| J1 ULN2003 | Uno D2 | D3 | D4 | D5 | 28BYJ-48 J1 |
| J2 ULN2003 | Uno D6 | D7 | D8 | D9 | 28BYJ-48 J2 |
| J3 ULN2003 | Uno D10 | D11 | D12 | D13 | 28BYJ-48 J3 |

All three driver board **VCC/+** terminals → external **regulated 5 V supply** (assuming 5 V motors).
All **GND/−** terminals → supply ground **and Arduino GND** (common reference).
Each motor's 5-wire plug → its own ULN2003 board's motor socket.
Optional hobby pen-lift servo signal → **Uno A0** (as digital pin), powered separately as appropriate and sharing GND. It is **disabled by default**.

**Do not power three motors from Uno 5 V or USB.** Verify the label on each motor: 12 V 28BYJ variants need a matching supply, not 5 V. Use a properly rated fused external supply and a **hardwired emergency cutoff**; the software STOP cannot replace a physical kill switch. Removing holding current by STOP/DISARM may allow a loaded arm to drop or drift: mechanically support it.

## Motor math / calibration

8-state half-step sequence energizes coil inputs IN1→IN4. 4096 half-steps/revolution is a nominal output-shaft value for many 28BYJ-48 units; some geartrains are approximately **4076**. Set `HALFSTEPS_PER_REV[]` by physical measurement, and `JOINT_GEAR_RATIO[]` for any added external reduction between output shaft and joint. Use `DIR_SIGN[]` to reverse axes after slow, pen-up tests.

UI step-position estimation assumes 4096 half-steps per joint revolution at 1:1 gearing until calibrated. It is **not an encoder measurement**. The controller is open-loop, and can lose steps under load.

A common 28BYJ-48 is low-cost but may be too weak or slow for a long 3R link + pen force. Test torque, backlash, sag, and drawing contact with each motor actually mounted before accepting any trajectory.

## Setup

1. Wire and check **one** driver/motor first with motor power off. Keep the arm mechanically supported.
2. Upload the Uno sketch; default `PEN_LIFT_INSTALLED=false` blocks physical pen-down writing.
3. Verify winding sequence at low speed; check rotation sense, backlash, heat, and output-shaft travel against the joint CAD. Configure motor ratios, physical limits, and pen lift before attaching the other motors.
4. Connect the live simulator in desktop Chrome/Edge: **Connect USB → Set zero → Arm → Jog ≤5°** (pen removed).
5. For full writing, install a real lift mechanism, calibrate up/down and safety interlocks, then enable pen-lift in firmware and test isolated strokes.
6. Firmware watchdog de-energizes all coils after 1s without heartbeat. A detached or overloaded arm can move while de-energized; do not rely solely on that behavior.

## USB protocol (115200 baud, ASCII newline)

`HELLO` returns `HELLO,3R-UNO,1,PEN=0,BOARD=ULN2003,STEPS=4096` unless pen lift enabled. The browser refuses to connect using an older STEP/DIR sketch. Other commands stay compatible:

`ZERO`, `ARM`, `Q,seq,j1_mdeg,j2_mdeg,j3_mdeg,lift_microns`, `STATUS`, `PING`, `DISARM`, `STOP`.

`STATE,armed,step1,step2,step3` is the commanded **coil-step counter**, not true shaft position; feedback of physical angles needs encoders. ZERO is manual declaration, not homing. `ACK,Q,seq` acknowledges a target, not completed motion.

## Planning API

`POST /api/plan` with JSON `{"text":"HELLO","speedMmPerSecond":15}` returns IK-validated joint waypoints; the Vercel server does **not** control your serial port. Only your local browser session (Web Serial) can command the Uno after a manual permission grant.

The existing 3R URDF/MJCF joint geometry is provisional; hardware is not validated against its CAD-derived visual mesh yet.
