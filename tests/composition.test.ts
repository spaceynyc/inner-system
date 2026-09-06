import { describe, expect, it } from 'vitest'
import { compositionSchema, decodeComposition, encodeComposition, PRESETS } from '../src/contracts/composition'
import { bandEnergy } from '../src/engine/audio/AudioEngine'

describe('portable compositions', () => {
  it('round-trips Unicode names and every setting', () => {
    const composition = { ...PRESETS[1], name: 'Indigo / 雲 · 03' }
    expect(decodeComposition(encodeComposition(composition))).toEqual(composition)
  })
  it('rejects unknown versions, external tracks, out-of-range settings and extra fields', () => {
    for (const patch of [{ version: 2 }, { response: 200 }, { track: 'external' }, { extra: true }, { clarity: NaN }]) {
      expect(compositionSchema.safeParse({ ...PRESETS[0], ...patch }).success).toBe(false)
    }
  })
  it('does not throw on damaged or oversized links', () => {
    expect(decodeComposition('%bad')).toBeNull()
    expect(decodeComposition('x'.repeat(5000))).toBeNull()
    expect(decodeComposition('%7B%7D')).toBeNull()
  })
})

describe('frequency analysis', () => {
  it('maps Hz to FFT bins and isolates a 100 Hz tone at different sample rates', () => {
    for (const rate of [44100, 48000]) {
      const data = new Uint8Array(512)
      data[Math.round(100 / (rate / 1024))] = 255
      expect(bandEnergy(data, rate, 1024, 30, 180)).toBeGreaterThan(0)
      expect(bandEnergy(data, rate, 1024, 2500, 14000)).toBe(0)
    }
  })
  it('handles silent and out-of-bounds ranges without NaN', () => {
    expect(bandEnergy(new Uint8Array(512), 48000, 1024, 30, 180)).toBe(0)
    expect(bandEnergy(new Uint8Array(512), 48000, 1024, 30000, 40000)).toBe(0)
  })
})
