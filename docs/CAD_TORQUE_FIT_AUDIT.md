# 3R Writing Robot — CAD, Fit, Torque and Physics Audit
Status: **Engineering estimate only. Not physically validated.** Based on the five user's original full-resolution STL files and 5V 28BYJ-48/ULN2003 literature.

## 1. Source CAD geometry and mass audit
The STL files are closed solids. Mesh-volume × **assumed solid PLA density 1.24 g/cm³**:

| Part | STL triangles | Volume cm³ | Solid PLA mass | CAD centroid from joint origin x |
|---|---:|---:|---:|---:|
| Base_Ring | 4364 | 50.483 | 62.60 g | – |
| Base_Lid | 5744 | 59.278 | 73.51 g | – |
| Link1 | 2218 | 32.488 | **40.29 g** | 66.56 mm |
| Link2 | 2004 | 28.619 | **35.49 g** | 54.87 mm |
| Link3_PenHolder | 1600 | 26.100 | **32.36 g** | 41.04 mm |

Printed real masses are unknown and depend on infill, wall thickness, supports, filament density, screws, bearings and couplers. These solid-mesh figures are NOT scale measurements.

Nominal **link-to-link pivot centers**: 120 mm, 100 mm; pen axis x=60 mm on Link3.
The original motor fixing-hole centers are: Base_Lid (-8,±17.5) mm, Link1 (112,±17.5) mm, Link2 (92,±17.5) mm. Hole diameter from actual STL vertex rings **~2.6 mm**. The commercial motor has **35 mm** lug spacing with **~4.2 mm** lug holes. Fastener size/clearance/washer arrangement and print strength must be checked with actual motor and screws, not assumed perfect.

Motor body dimensions used in graphics: nominal 28 mm diameter × 19 mm depth, shaft offset 8 mm. The source CAD has no motor solids. CAD layout estimates mounting from undersides. Conceptual shaft extensions needed between housing face and joint axis are ~9 mm (J1) and ~4 mm (J2/J3) if relying on the motor's nominal 10 mm shaft projection. THESE ARE NOT PROVEN GEOMETRIES; couplers, shaft engagement, axial support, screw head interference, flange z-offset and collision must be physically measured.

## 2. Gravity and motor torque are different load cases

All three joint axes are modeled vertical (+Z): **gravity creates no ideal gravitational twisting moment about Z**. Gravity creates **axial load and out-of-plane bending** on shafts and supports, and thus friction/binding/sag.

Assumed masses: link values above; downstream J2 motor 32g, J3 motor 32g; pen attachment 18g. At a fully extended configuration, illustrative moving load at J1 is ~**190 g**, downward gravity force **1.87 N** and static overturning/bending moment roughly **0.326 N·m**. This is NOT joint-driving torque, but shows why bearing/shaft support is critical. Housing J1 motor mass is fixed to the base.

## 3. Nominal torque comparison

Example 28BYJ-48 5V specification: **in-traction torque >34.3 mN·m at 120 Hz** (quoted test condition). This is **not** a complete torque-speed curve nor a guarantee at 400 half-steps/s. Source: https://www.mouser.com/datasheet/2/813/step_motor_5v_28byj48_datasheet-3247591.pdf . Other motor variants may differ.

Conservative, worst-direction fully-extended pen drag with simultaneous modeled angular acceleration:
- Joint reaches: J1=0.28m, J2=0.16m, J3=0.06m.
- Effective inertias from solid link STL plus assumed downstream motor and pen masses: J1=0.007045, J2=0.001607, J3=0.000142 kg·m².
- Required torque estimate = **I_eff × |angular acceleration| + F_pen × reach**. This overbounds independent-axis acceleration effects in some postures, but **omits bearing drag, backlash, gearbox friction, electrical torque-speed derating, stall impact and dynamic cross-coupling**.

Assuming 0.50 rad/s² and sideways pen force:

| Pen drag | J1 | J2 | J3 | J1 / 34.3mNm reference |
|---|---:|---:|---:|---:|
| 0.05 N | 17.5 mNm | 8.8 mNm | 3.1 mNm | 51% |
| 0.10 N | 31.5 mNm | 16.8 mNm | 6.1 mNm | 92% |
| 0.15 N | 45.5 mNm | 24.8 mNm | 9.1 mNm | **133%** |
| 0.20 N | 59.5 mNm | 32.8 mNm | 12.1 mNm | **174%** |

The example 34.3mNm figure is a lower-spec point, not a tested upper physical limit; exceeding it means **performance unverified / likely margin problem**, not proof that the motor cannot turn. At 0.10N the base joint is already close to this reference BEFORE losses. A notional 50% torque reserve at 0.5 rad/s² would restrict pen drag to ~0.049N in this model.

## 4. Step rate and handwriting

Assuming 4096 half-steps per output revolution and 1:1 coupling:
- 120 half-steps/s ≈ 10.55°/s ≈ 1.76 rpm output.
- Existing Uno firmware upper rate 400 half-steps/s ≈ 35.16°/s ≈ 5.86 rpm, **not a verified loaded speed**.
- An offline recreation of the existing 'HELLO' font trajectory at 15mm/s produces roughly **315, 269, 308 half-steps/s peak** on J1, J2, J3. Those are target rates, NOT measured speed. The path is piecewise linear in XY with unsmoothed corners, so acceleration may exceed motor capability.
- Planning API now stretches per-segment times to target **≤100 half-steps/s** as an exploratory rate limit. This does not implement full acceleration- or jerk-limited motion, nor ensure all command targets settle. The Uno is open-loop with no encoders.

The 28BYJ-48 gearbox backlash and pen loading may distort handwriting substantially even when commanded step counts look correct.

## 5. Electronics and design changes

Motor channels use **three ULN2003 boards × 4 inputs = 12 Uno digital outputs**. Each 5V variant needs a separate regulated 5V supply; do NOT draw motor current from Uno USB. The ULN2003 Darlington switch incurs a collector saturation voltage loss (typically around 1V at specified currents), reducing coil voltage and torque. Source: https://www.ti.com/product/ULN2003A . Check actual motor voltage label. Shared grounds, fusing and a physical motor-power cutoff are required.

Original physics values (Link masses 200g/160g/100g and allowed torques 1.5/1.1/0.7 N·m) were NOT realistic for this hardware. Updated URDF/MJCF use the CAD-derived mass/inertia estimates, two assumed downstream 32g motor housings, and illustrative actuator torque limits ±0.0343 N·m. The pen-lift slide remains **virtual**; no servo is assumed physically installed.

## 6. Validation required before claiming exact assembly or real-world handwriting

1. Weigh the three actual printed links, motors, pen and fasteners; record actual infill and material.
2. Fit each 28BYJ-48 to the exact printed holes with actual screws/washers; verify hole tolerance, shaft diameter, insertion depth and coupler.
3. Verify motor pocket clearance against link motion **through the entire joint workspace**, not just at zero.
4. Fit independent bearings/supports for link loads; don't assume the geared stepper output shaft can carry the ~0.326 N·m bending moment.
5. Measure current and voltage at each ULN2003 motor while driving the configured external supply.
6. Bench-measure output torque vs step rate using controlled loads (e.g. pulley radius and force gauge), cold and warm; benchmark J1 at 100, 120, 200 and 400 half-steps/s.
7. Calibrate commanded-vs-real angle, joint zero references, backlash and travel hard stops; add home/limit sensors and collision interlocks.
8. Test unloaded motor-only motion, then arm without pen, then very light non-contact writing, and only then contact force. Never assume virtual pen lift exists physically.

**Verdict:** A vertical-axis, very light PLA arm may be able to move under 28BYJ-48 motors. Continuous-contact pen writing and fast handwriting have **narrow or negative estimated torque margin**, especially at the base joint. Exact mechanical fit and reliable physical writing **cannot be certified from STL + motor model alone**.
