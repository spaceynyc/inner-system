import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from '../src/engine/audio/AudioEngine'

class TestAudio extends EventTarget {
  static instances: TestAudio[] = []
  paused = true; loop = false; preload = ''; currentTime = 0; duration = 64; error = null
  constructor(public src: string) { super(); TestAudio.instances.push(this) }
  play = vi.fn(async () => { this.paused = false; this.dispatchEvent(new Event('playing')) })
  pause = vi.fn(() => { this.paused = true; this.dispatchEvent(new Event('pause')) })
  load = vi.fn()
  removeAttribute = vi.fn()
}
const disconnect = vi.fn()
const node = () => ({ connect: vi.fn(), disconnect })
class TestContext extends EventTarget {
  static instances: TestContext[] = []
  state = 'running'; sampleRate = 48000; currentTime = 0; destination = {}
  resume = vi.fn(async () => {})
  close = vi.fn(async () => {})
  constructor() { super(); TestContext.instances.push(this) }
  createAnalyser = () => ({ ...node(), fftSize: 1024, frequencyBinCount: 512, smoothingTimeConstant: 0, getByteFrequencyData: (data: Uint8Array) => data.fill(100) })
  createMediaElementSource = vi.fn(node)
  createGain = () => ({ ...node(), gain: { value: 1, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } })
  createOscillator = vi.fn(() => ({ ...node(), type: 'sine', frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), onended: null as null | (() => void) }))
}
let engine: AudioEngine
beforeEach(() => {
  TestAudio.instances = []; TestContext.instances = []; vi.clearAllMocks()
  vi.stubGlobal('Audio', TestAudio); vi.stubGlobal('AudioContext', TestContext)
  engine = new AudioEngine()
})
afterEach(() => { engine.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('audio lifecycle', () => {
  it('keeps gesture tones silent before playback and bounds and cleans up active voices', async () => {
    engine.resonate(1, 2)
    expect(TestContext.instances).toHaveLength(0)
    await engine.play()
    const context = TestContext.instances[0]
    for (let i = 0; i < 20; i++) { context.currentTime += .1; engine.resonate(.8, 3) }
    expect(context.createOscillator).toHaveBeenCalledTimes(8)
    const voice = context.createOscillator.mock.results[0].value
    expect(voice.frequency.value).toBe(196)
    expect(voice.start).toHaveBeenCalledTimes(1)
    engine.pause(); engine.resonate(1, 1)
    expect(context.createOscillator).toHaveBeenCalledTimes(8)
    expect(voice.stop).toHaveBeenCalledTimes(2)
    expect(voice.onended).toBeNull()
  })
  it('creates no media or audio context before a play gesture and reuses its graph', async () => {
    expect(TestContext.instances).toHaveLength(0)
    expect(TestAudio.instances).toHaveLength(0)
    await engine.play(); engine.pause(); await engine.play()
    expect(TestContext.instances).toHaveLength(1)
    expect(TestContext.instances[0].createMediaElementSource).toHaveBeenCalledTimes(1)
    expect(engine.getSnapshot().status).toBe('playing')
  })
  it('does not restart after pause races with a pending resume', async () => {
    await engine.play()
    let resume!: () => void
    TestContext.instances[0].resume.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve }))
    const pending = engine.play(); engine.pause(); resume(); await pending
    expect(TestAudio.instances[0].play).toHaveBeenCalledTimes(1)
    expect(engine.getSnapshot().status).toBe('paused')
  })
  it('releases file URLs when replacing, restoring, and disposing local audio', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second').mockReturnValueOnce('blob:third')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const file = new File(['audio'], 'my-signal.mp3', { type: 'audio/mpeg' })
    await engine.useFile(file); await engine.useFile(file)
    expect(revoke).toHaveBeenCalledWith('blob:first')
    engine.useOriginal(); expect(revoke).toHaveBeenCalledWith('blob:second')
    expect(engine.getSnapshot()).toMatchObject({ local: false, status: 'paused' })
    await engine.useFile(file); engine.dispose()
    expect(create).toHaveBeenCalledTimes(3)
    expect(revoke).toHaveBeenCalledWith('blob:third')
    expect(TestContext.instances[0].close).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(3)
  })
  it('reports rejected playback and invalid local files without reporting playback', async () => {
    await expect(engine.useFile(new File(['text'], 'readme.txt'))).rejects.toThrow('Choose an MP3')
    await engine.play(); engine.pause()
    TestAudio.instances[0].play.mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'))
    await engine.play()
    expect(engine.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('Press play') })
  })
  it('uses real frequency data and decays levels after pausing', async () => {
    await engine.play(); engine.sample(0.1)
    const active = engine.levels.bass
    expect(active).toBeGreaterThan(0)
    engine.pause(); engine.sample(0.1)
    expect(engine.levels.bass).toBeLessThan(active)
  })
})
