# Smooth writing and image line art

## Root causes
- Each ink sample rebuilt all accumulated THREE.BufferGeometry; longer strokes caused rendering slowdown.
- The path advanced independently of torque-limited MuJoCo motors, so actual simulated pen positions lagged targets.
- A variable step count followed the render frame timing.
- Dense scribble pointer events forced immediate canvas redraws and excessive waypoints.
- Uploaded photos previously used colored-region contours, not edge-detected line art.

## Corrections
- Fixed 2 ms MuJoCo integration and reference slew limited to 0.3 rad/s, with actual simulated pen tracking error displayed.
- Default MuJoCo writing playback 0.35×, selectable 0.2× to 1×; torque ceilings remain unchanged.
- Cubic Hermite interpolated reference within ink strokes, with smooth transitions at stroke boundaries.
- 3D ink GPU geometry now uses geometrically expanding buffers rather than whole-path reconstruction.
- Frame-throttled pointer capture and freehand path simplification in metric robot coordinates.
- Grayscale blur, Sobel gradients, nonmaximum suppression and image-edge polyline extraction for Clean Outline, Tattoo Stencil, and Pencil-line Sketch. Processed preview allows inspection.

## Important limitations
No AI portrait interpretation is implied: the three styles trace and simplify visible photo edges, they do not identify anatomical features. MuJoCo remains a torque-limited approximation; slight following error is physically meaningful and should not be hidden. A virtual smooth trace is not proof that an actual 28BYJ-48/ULN2003 motor can track the path. Image drawing stays simulation-only; hardware has no pen changing mechanism or calibrated pen lift.
