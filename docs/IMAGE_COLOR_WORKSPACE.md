# Image → Drawing and virtual color pen support

This is a **contour plotter**, not a photo printer.

## Input
The fourth input mode accepts PNG/JPEG/WEBP/GIF/BMP through file selection, drag/drop, or Ctrl+V paste. Images are decoded *locally in the browser*, reduced to at most 160 px per side in color mode (210 mono), and classified as:
- monochrome dark outlines; or
- nearest of Black, Blue, Red, Green, Orange virtual pens.

Each colored region is vectorized into **boundary contours**, retaining color metadata per stroke. Output is fed into the same IK-based trajectory system as English/Hindi/freehand input. Color layers are grouped by virtual pen, and the 3D ink visualization uses their actual colors. The simulator's physical pen tip is a tapered ballpoint-style geometry; its tip apex coincides with local Z=-82 mm.

## Per-design data
After **Convert image to robot paths** (or **Plan & simulate** for other modes), download:
- **.3r.json**: source filename, MIME, original/traced dimensions, file byte size, timestamp, palette, conversion mode, source stroke count, robot parameters, each waypoint's 3 joint angles (radians), XY (metres), lift, color, stroke group, timing, and ink state.
- **.trajectory.csv**: one row per planned waypoint for inspection in Excel or research analysis.

No original image pixels are uploaded to the Vercel backend. JSON contains the traced/kinematic data, not the original file bytes.

## Boundaries
- Best on logos, black-and-white line drawings and flat illustrations. **Not** photorealistic shading, pencil pressure, or true color mixing.
- Color similarity grouping can reduce gradients and subtle colors; large backgrounds close to white are excluded.
- Tracing dense images is bounded by max 150 strokes, 18k source points, and 7500 robot waypoints. Simpler source illustrations produce better results.
- Image/multicolor real-hardware transmission is **intentionally disabled**. The Uno has one real pen and no physical pen changer. Simulation colors do not become actual colors on paper.
- Before any physical job, motor torque, collisions, acceleration, homing and real pen-lift need verification.
