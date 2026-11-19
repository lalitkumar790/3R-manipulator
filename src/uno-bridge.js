// Local, permission-gated USB bridge. Vercel never sees or opens the USB port.
// Requires desktop Chrome/Edge over HTTPS and a compatible Arduino Uno sketch.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
export class UnoBridge {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.port = null; this.reader = null; this.writer = null;
    this.connected = false; this.armed = false; this.calibrated = false;
    this.busy = false; this.abort = false; this.seq = 0; this.received = [];
    this.estimatedQ = null; this.heartbeat = null; this.lastReply = 0; this.lastJog = [0,0,0]; this.penLiftInstalled = false; this.hello = false; this.fault = null; this.stepsPerRevolution = 4096;
  }
  async connect() {
    if (!('serial' in navigator)) throw new Error('Web Serial requires desktop Chrome or Edge on HTTPS.');
    if (this.port) throw new Error('Already connected.');
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 115200, bufferSize: 256 });
    this.writer = this.port.writable.getWriter();
    this.connected = true; this.abort = false; this.armed = false; this.calibrated = false;
    this.readLoop();
    await wait(1700); // Arduino Uno resets on USB serial opening
    await this.commandAndWait('HELLO','HELLO,3R-UNO,1',1200);
    if (!this.hello) throw new Error('Expected 3R Uno firmware protocol v1');
    if (!this.boardVerified) { await this.disconnect(); throw new Error('Upload ULN2003 firmware. Existing sketch targets incompatible STEP/DIR drivers.'); }
    this.onStatus('USB connected. Align all joint zero marks, then press Set zero.');
  }
  async readLoop() {
    let buffer = '';
    try {
      while (this.port?.readable) {
        const reader = this.port.readable.getReader(); this.reader = reader;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += new TextDecoder().decode(value);
            let e;
            while ((e = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, e).trim(); buffer = buffer.slice(e + 1);
              if (!line) continue;
              this.received.push(line); if (this.received.length > 80) this.received.shift();
              this.lastReply = performance.now();
              if (line.startsWith('HELLO,3R-UNO,1')) { this.hello = true; this.penLiftInstalled = line.includes('PEN=1');
                this.boardVerified = line.includes('BOARD=ULN2003');
                const stepField=line.split(',').find(x=>x.startsWith('STEPS='));
                if(stepField){const n=Number(stepField.slice(6));if(Number.isFinite(n)&&n>0)this.stepsPerRevolution=n;} }
              if (line.startsWith('FAULT') || line.startsWith('ERR')) {
                this.fault = line;
                if (line.includes('TIMEOUT') || line.includes('DISARM')) this.armed = false;
                this.onStatus(line);
              }
              if (line.startsWith('STATE,')) {
                const chunks=line.split(',');
                const steps=chunks.slice(2,5).map(Number);
                if(chunks.length===5 && steps.length===3 && steps.every(Number.isFinite)) {
                  // Estimates derived from firmware step counters, NOT measured shaft angles.
                  this.estimatedQ=steps.map(n=>n*Math.PI*2/this.stepsPerRevolution);
                }
              }
              if (line.startsWith('STATE')) this.onStatus(line);
            }
          }
        } finally { reader.releaseLock(); this.reader = null; }
      }
    } catch (e) { this.onStatus('USB read interrupted: ' + e.message); }
    finally {
      this.connected = false; this.armed = false; this.calibrated = false;
      clearInterval(this.heartbeat);
      this.abort = true;
      this.onStatus('USB disconnected; coils should de-energize after watchdog timeout. Verify physical power state.');
    }
  }
  async send(line) {
    if (!this.connected || !this.writer) throw new Error('Arduino USB connection is not active');
    if (!/^[A-Z0-9,\-]+$/.test(line) || line.length > 62) throw new Error('Invalid serial command');
    await this.writer.write(new TextEncoder().encode(line + '\n'));
  }
  async commandAndWait(command, prefix, timeout = 900) {
    this.received = [];
    await this.send(command);
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const i = this.received.findIndex(s => s.startsWith(prefix));
      if (i >= 0) return this.received.splice(i, 1)[0];
      const err = this.received.find(s => s.startsWith('ERR') || s.startsWith('FAULT'));
      if (err) throw new Error(err);
      await wait(20);
    }
    throw new Error('No expected acknowledgement from Arduino: ' + command);
  }
  async setZero() {
    if (this.busy || this.armed) throw new Error('Disarm first.');
    await this.commandAndWait('ZERO','OK,ZERO');
    this.calibrated = true; this.lastJog = [0,0,0]; this.estimatedQ=[0,0,0];
    this.onStatus('Logical zero recorded (not homed). Physically check the joint marks.');
  }
  async arm() {
    if (!this.calibrated || this.busy) throw new Error('Set mechanical zero first.');
    await this.commandAndWait('ARM','OK,ARM');
    this.armed = true;
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (this.connected && this.armed && !this.busy) this.send('PING').catch(e=>this.onStatus('Heartbeat error: '+e.message));
    }, 250);
    this.onStatus('ARMED — ULN2003 coils energized; keep clear of moving links.');
  }
  async jog(anglesRad) {
    if (!this.armed || !this.calibrated || this.busy) throw new Error('Connect, zero and arm first.');
    if (!Array.isArray(anglesRad) || anglesRad.length !== 3) throw new Error('Expected 3 joint angles');
    const next = anglesRad.map(a => Math.round(a * 180000 / Math.PI));
    const current = this.lastJog.map(a => Math.round(a * 180000 / Math.PI));
    if (next.some((v,i)=>!finite(v,-150000,150000)||Math.abs(v-current[i])>5000))
      throw new Error('Jog limited to 5° per joint relative to last accepted command.');
    const response = await this.commandAndWait(['Q',++this.seq,...next,12000].join(','),'ACK,Q,',900);
    this.lastJog = [...anglesRad];
    this.onStatus('Jog target accepted by Uno (estimated; no encoder feedback).');
    return response;
  }
  async disarm() {
    this.abort = true; this.armed = false; clearInterval(this.heartbeat);
    if (this.connected) { await this.send('DISARM'); this.onStatus('Disarm requested'); }
  }
  async stop() {
    this.abort = true; this.armed = false; this.calibrated = false; clearInterval(this.heartbeat);
    if (this.connected) { await this.send('STOP'); this.onStatus('STOP requested — verify motor power state'); }
  }
  async run(points, onProgress = () => {}) {
    if (!this.armed || !this.calibrated || this.busy) throw new Error('Connect, zero and arm before execution.');
    if (!this.penLiftInstalled) throw new Error('Firmware reports no pen-lift installed. Configure and test pen-lift hardware first.');
    if (!Array.isArray(points) || !points.length || points.length > 7500) throw new Error('Invalid waypoint count');
    // Preflight entire trajectory before any movement, rejecting unsafe targets.
    const commands = points.map(p => {
      if (!p || !Array.isArray(p.q) || p.q.length !== 3 || !finite(p.lift,0,.012) || !finite(p.dt,.001,2))
        throw new Error('Invalid trajectory point');
      const degrees = p.q.map(q => Math.round(q * 180000 / Math.PI));
      if (degrees.some(v => !finite(v,-150000,150000))) throw new Error('Trajectory exceeds conservative ±150° joint limit');
      return { q:degrees, lift:Math.round(p.lift*1000000), dt:p.dt };
    });
    this.busy = true; this.abort = false; this.fault = null;
    try {
      const start = performance.now(); let elapsed = 0, lastTx = -Infinity, lastHeart = -Infinity;
      for (let i = 0; i < commands.length; i++) {
        if (this.fault) throw new Error(this.fault);
        if (this.abort || !this.armed || !this.connected) throw new Error('Execution stopped / link lost');
        const cmd = commands[i]; elapsed += cmd.dt * 1000;
        // Limit serial updates to ~20 Hz while preserving segment endpoints.
        const isLast = i === commands.length - 1;
        if (elapsed - lastTx >= 50 || isLast) {
          const line = ['Q', ++this.seq, ...cmd.q, cmd.lift].join(',');
          await this.send(line); lastTx = elapsed; onProgress(i+1,commands.length);
        }
        const deadline = start + elapsed;
        while (performance.now() < deadline) {
          if (this.fault) throw new Error(this.fault);
          if (this.abort || !this.connected || !this.armed) throw new Error('Execution interrupted');
          if (performance.now() - lastHeart > 220) { await this.send('PING'); lastHeart = performance.now(); }
          await wait(Math.min(25,Math.max(1,deadline-performance.now())));
        }
      }
      // Report command stream completion, not confirmed physical tracking.
      this.lastJog = [...points[points.length-1].q];
      this.onStatus('All position targets transmitted; stepper positions are open-loop estimates.');
    } catch (e) {
      try { if (this.connected) await this.send('STOP'); } catch {}
      this.armed = false; this.calibrated = false; clearInterval(this.heartbeat);
      throw e;
    } finally { this.busy = false; }
  }
  async disconnect() {
    if (this.busy) await this.stop();
    else if (this.connected) await this.disarm();
    this.abort = true; clearInterval(this.heartbeat);
    try { await this.reader?.cancel(); } catch {}
    try { this.writer?.releaseLock(); } catch {}
    try { await this.port?.close(); } catch {}
    this.port = null; this.writer = null; this.connected = false;
    this.armed = false; this.calibrated = false;
  }
}
