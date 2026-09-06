import { describe, expect, it } from 'vitest'
import { GestureEngine } from '../src/engine/performance/GestureEngine'
const advance = (engine: GestureEngine, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) engine.step(1 / 60) }
describe('observatory gestures', () => {
  it('charges on hold, emits on release, and settles without stuck input', () => {
    const engine = new GestureEngine()
    engine.hold(); advance(engine, 2)
    expect(engine.charge).toBe(1)
    engine.release(); expect(engine.echoId).toBe(1); expect(engine.input.held).toBe(false)
    advance(engine, 5)
    expect(engine.waves).toHaveLength(0); expect(engine.active).toBe(false)
  })
  it('records a gesture and replays its direction and release on successive loops', () => {
    const engine = new GestureEngine()
    engine.record(); engine.point(0.6, -0.4); engine.hold(); advance(engine, 2); engine.release(); advance(engine, 6.1)
    expect(engine.mode).toBe('replaying'); expect(engine.hasTake).toBe(true)
    const before = engine.echoId
    advance(engine, 2.1)
    expect(engine.echoId).toBe(before + 1)
    expect(engine.input.x).toBeCloseTo(0.6)
    advance(engine, 8)
    expect(engine.echoId).toBe(before + 2)
  })
  it('cancels held input and lets a fresh gesture interrupt replay', () => {
    const engine = new GestureEngine()
    engine.record(); advance(engine, 8.1); engine.hold()
    expect(engine.mode).toBe('live'); engine.cancel(); expect(engine.input.held).toBe(false)
    engine.reset(); expect(engine.hasTake).toBe(false); expect(engine.active).toBe(false)
  })
  it('bounds pointer input, stalled-frame time, and simultaneous waves', () => {
    const engine = new GestureEngine()
    engine.point(100, -100); expect(engine.input).toMatchObject({ x: 1, y: -1 })
    engine.hold(); engine.step(1000); expect(engine.charge).toBeLessThan(1)
    for (let i = 0; i < 100; i++) engine.strike()
    expect(engine.waves).toHaveLength(6)
  })
  it('keeps the eight-second take accurate across slow frames and preserves an initially open form', () => {
    const engine = new GestureEngine()
    engine.hold(); advance(engine, 2); engine.record()
    for (let i = 0; i < 17; i++) engine.step(.5)
    expect(engine.mode).toBe('replaying')
    expect(engine.elapsed).toBeCloseTo(.5, 1)
    expect(engine.charge).toBe(1)
  })
})
