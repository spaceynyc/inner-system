export type GestureInput = { x: number; y: number; held: boolean }
type Frame = GestureInput & { at: number }
type Strike = { at: number; power: number }
export const TAKE_SECONDS = 8
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** A bounded, frame-rate-independent gesture take. No audio, DOM, or renderer dependencies. */
export class GestureEngine {
  input: GestureInput = { x: 0, y: 0, held: false }
  charge = 0
  recoil = 0
  elapsed = 0
  time = 0
  echoId = 0
  lastPower = 0
  mode: 'live' | 'recording' | 'replaying' = 'live'
  waves: { age: number; power: number }[] = []
  private frames: Frame[] = []
  private strikes: Strike[] = []
  private nextStrike = 0
  private initialCharge = 0
  get hasTake() { return this.frames.length > 1 }
  get active() { return this.input.held || this.mode !== 'live' || this.waves.length > 0 || this.charge > 0.001 || this.recoil > 0.001 }
  point(x: number, y: number) { this.input.x = clamp(x, -1, 1); this.input.y = clamp(y, -1, 1) }
  hold() { if (this.mode === 'replaying') this.stop(); this.input.held = true }
  release() { if (this.input.held) { this.input.held = false; this.strike(Math.max(0.22, this.charge)) } }
  cancel() { this.input.held = false }
  strike(power = 0.85) {
    this.lastPower = clamp(power, 0.15, 1)
    this.recoil = this.lastPower
    this.charge = 0
    this.echoId++
    this.waves.push({ age: 0, power: this.lastPower })
    this.waves = this.waves.slice(-6)
    if (this.mode === 'recording') this.strikes.push({ at: this.elapsed, power: this.lastPower })
  }
  record() {
    this.initialCharge = this.charge
    this.mode = 'recording'; this.elapsed = 0; this.frames = [{ ...this.input, at: 0 }]; this.strikes = []
  }
  replay() {
    if (!this.hasTake) return
    this.mode = 'replaying'; this.elapsed = 0; this.nextStrike = 0
    this.input = { ...this.frames[0] }; this.charge = this.initialCharge; this.recoil = 0; this.waves = []
  }
  stop() { this.mode = 'live'; this.input.held = false; this.elapsed = 0 }
  reset() {
    this.stop(); this.point(0, 0); this.charge = 0; this.recoil = 0; this.waves = []
    this.frames = []; this.strikes = []; this.time = 0
  }
  step(seconds: number) {
    // Substeps preserve take timing on slow devices without unstable visual jumps.
    let remaining = clamp(Number.isFinite(seconds) ? seconds : 0, 0, 1)
    while (remaining > .000001) { const dt = Math.min(1 / 30, remaining); this.advance(dt); remaining -= dt }
  }
  private advance(dt: number) {
    this.time += dt
    this.waves.forEach((wave) => { wave.age += dt })
    this.waves = this.waves.filter((wave) => wave.age < 3)
    this.recoil *= Math.exp(-dt * 1.7)
    if (this.mode === 'replaying') {
      this.elapsed += dt
      if (this.elapsed >= TAKE_SECONDS) {
        while (this.nextStrike < this.strikes.length) this.strike(this.strikes[this.nextStrike++].power)
        this.elapsed %= TAKE_SECONDS; this.nextStrike = 0; this.charge = this.initialCharge
      }
      let index = Math.min(this.frames.length - 1, Math.floor(this.elapsed / TAKE_SECONDS * (this.frames.length - 1)))
      while (index > 0 && this.frames[index].at > this.elapsed) index--
      while (index < this.frames.length - 1 && this.frames[index + 1].at <= this.elapsed) index++
      const a = this.frames[index], b = this.frames[Math.min(index + 1, this.frames.length - 1)]
      const t = clamp((this.elapsed - a.at) / Math.max(0.001, b.at - a.at), 0, 1)
      this.input = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, held: a.held }
      while (this.nextStrike < this.strikes.length && this.strikes[this.nextStrike].at <= this.elapsed) this.strike(this.strikes[this.nextStrike++].power)
    }
    this.charge = this.input.held ? Math.min(1, this.charge + dt / 1.6) : this.charge * Math.exp(-dt * 4)
    if (this.mode === 'recording') {
      this.elapsed = Math.min(TAKE_SECONDS, this.elapsed + dt)
      // Keep at most 30 samples/second even on a 240 Hz display.
      if (this.elapsed - this.frames[this.frames.length - 1].at >= 1 / 30 || this.elapsed === TAKE_SECONDS) this.frames.push({ ...this.input, at: this.elapsed })
      if (this.elapsed >= TAKE_SECONDS) this.replay()
    }
  }
}
export const gestureEngine = new GestureEngine()
export function wakeObservatory() { window.dispatchEvent(new Event('observatory-input')) }
