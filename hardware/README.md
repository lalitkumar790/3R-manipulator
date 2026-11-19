# Arduino Uno + Vercel digital twin hardware bridge

The UI has **two distinct controls**: simulation writing and a physically armed USB execution.
The cloud does **NOT** directly command motor drivers. /api/plan is stateless planning only.
Live USB commands require a local, interactive Web Serial browser session (Chrome or Edge, HTTPS).

## Wiring: external step/dir motor drivers ONLY

| Arduino Uno | External driver input |
| --- | --- |
| D2 / D3 | J1 STEP / DIR |
| D4 / D5 | J2 STEP / DIR |
| D6 / D7 | J3 STEP / DIR |
| D8 | Shared ENABLE (assumes active LOW; check driver datasheet) |
| D9 | Optional pen-lift hobby servo PWM |
| GND | Shared logic ground with external drivers |

The steppers must be powered by a **separate, driver-appropriate motor supply**;
never power them from Uno I/O or the USB 5 V line. Driver wiring (including
active-level and current limits) varies among A4988, DRV8825, TMC and others.
Provide a separate servo supply sized for peak current if using a pen servo;
connect grounds appropriately. Fit a **physical emergency power cutoff** to
motor power, travel stops and home switches before practical operation.
Do not enable an unsecured network-to-motor relay.

## Firmware setup
1. Open `hardware/arduino_uno/three_r_uno/three_r_uno.ino` in Arduino IDE;
   select Arduino Uno and its port.
2. **Configure** microstepping, motor-to-joint gear ratios, driver-enable logic,
   DIR polarity, physical joint limits, and pen servo geometry for your exact hardware.
3. `PEN_LIFT_INSTALLED=false` intentionally prevents pen-down. Set true only
   after installing and safely calibrating the pen-lift servo. Without this
   actuator, the writing path cannot lift between letters.
4. Flash, leave motor drivers disabled, align all three joints to documented
   mechanical zero reference marks (this sketch has no homing sensors).
5. Open the Vercel app in desktop Chrome or Edge over HTTPS. Click **Connect USB**,
   grant serial access, and verify `HELLO,3R-UNO,1`.
6. Click **Set zero** while the motors are disabled, then **Arm drivers**.
   Use a tiny pen-up movement with the pen removed and workspace clear before trying a stroke.
7. **Send writing to Uno** plans the text and transmits time-scheduled joint
   target angles. Use **STOP** to disarm; the physical e-stop is authoritative.

## Wire protocol, 115200 baud / newline ASCII
Commands:
- `HELLO` → `HELLO,3R-UNO,1`
- `ZERO` → `OK,ZERO` (manual logical zero, not homing)
- `ARM` → `OK,ARM`
- `PING` → `OK,PING` (watchdog 1000 ms)
- `Q,seq,j1_mdeg,j2_mdeg,j3_mdeg,lift_microns` → `ACK,Q,seq`
- `STATUS` → `STATE,armed,step1,step2,step3`
- `DISARM` → `OK,DISARM`
- `STOP` → `OK,STOP`, requiring ZERO again

Angles are relative to the manually established logical zero. They are *not*
absolute measured joint positions. `ACK` only means a target was accepted;
it does not guarantee the motor has reached that position.
The firmware limits angles to ±150° and rates to ~400 steps/sec/axis
in this initial prototype. Those are arbitrary conservative software settings,
**not safe mechanical travel limits**. The USB host sends a 250ms heartbeat;
firmware disables drivers after ~1s without traffic.

## API
```http
POST /api/plan
Content-Type: application/json

{"text":"HELLO","speedMmPerSecond":15}
```
Response contains an IK-validated array of `{x,y,q:[radians],lift,ink,dt}`.
This endpoint performs no hardware actions. `GET /api/health` reports planning capability.

## Known limitations
- Three Uno-controlled stepper axes are open-loop without step encoders; STEP
  counters cannot detect lost steps or collisions. A trustworthy digital twin
  needs homing sensors or encoders + calibration of joint offsets.
- Joints and motor coupling remain estimated from STL hole locations (120/100/60 mm).
- USB serial needs a user-present browser. Background remote automation from
  Vercel would need a secure dedicated local agent with authentication, authorization
  and independent safety interlocks; intentionally not offered here.
- Plan timestamps are not a guarantee of motor following; motion queueing, acceleration,
  homing, collision checking and PID/driver configuration remain future tasks.
