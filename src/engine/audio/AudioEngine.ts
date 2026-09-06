export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'
export type AudioSnapshot = { status: AudioStatus; title: string; currentTime: number; duration: number; volume: number; local: boolean; error: string }
export type Frequencies = { bass: number; mid: number; high: number; average: number }

export function bandEnergy(data: Uint8Array, sampleRate: number, fftSize: number, minHz: number, maxHz: number): number {
  const start = Math.max(0, Math.floor(minHz / (sampleRate / fftSize)))
  const end = Math.min(data.length, Math.ceil(maxHz / (sampleRate / fftSize)))
  if (end <= start) return 0
  let total = 0
  for (let i = start; i < end; i++) total += data[i]
  return total / ((end - start) * 255)
}

export class AudioEngine {
  private audio: HTMLAudioElement | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaElementAudioSourceNode | null = null
  private gain: GainNode | null = null
  private data = new Uint8Array(512)
  private listeners = new Set<() => void>()
  private objectUrl: string | null = null
  private intent = 0
  private snapshot: AudioSnapshot = { status: 'idle', title: 'Inner signal', currentTime: 0, duration: 0, volume: 0.55, local: false, error: '' }
  readonly levels: Frequencies = { bass: 0, mid: 0, high: 0, average: 0 }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.snapshot
  private update(patch: Partial<AudioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  private initialize() {
    if (this.audio) return
    const audio = new Audio('/assets/track.mp3')
    audio.loop = true
    audio.preload = 'metadata'
    this.audio = audio
    audio.addEventListener('playing', () => this.update({ status: 'playing', error: '' }))
    audio.addEventListener('pause', () => { if (this.snapshot.status !== 'error') this.update({ status: 'paused' }) })
    audio.addEventListener('waiting', () => { if (!audio.paused) this.update({ status: 'loading' }) })
    audio.addEventListener('timeupdate', () => this.update({ currentTime: audio.currentTime }))
    audio.addEventListener('durationchange', () => this.update({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }))
    audio.addEventListener('error', () => this.update({ status: 'error', error: 'This audio could not be loaded. Try another file or retry.' }))
  }
  private connect() {
    this.initialize()
    if (this.context) return
    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.7
    this.data = new Uint8Array(this.analyser.frequencyBinCount)
    this.source = this.context.createMediaElementSource(this.audio!)
    this.gain = this.context.createGain()
    this.gain.gain.value = this.snapshot.volume
    this.source.connect(this.analyser)
    this.analyser.connect(this.gain)
    this.gain.connect(this.context.destination)
    this.context.addEventListener('statechange', () => {
      if (this.context?.state === 'suspended' && this.snapshot.status === 'playing') {
        this.audio?.pause()
        this.update({ status: 'paused' })
      }
    })
  }
  async play() {
    const intent = ++this.intent
    try {
      this.connect()
      this.update({ status: 'loading', error: '' })
      if (this.audio?.error) this.audio.load()
      await this.context!.resume()
      if (intent !== this.intent) return
      await this.audio!.play()
      if (intent !== this.intent) this.audio!.pause()
    } catch (error) {
      if (intent !== this.intent) return
      const blocked = error instanceof DOMException && error.name === 'NotAllowedError'
      this.update({ status: 'error', error: blocked ? 'Your browser paused audio. Press play to start it.' : 'Playback could not start. Retry or choose a different audio file.' })
    }
  }
  pause() { this.intent++; this.audio?.pause(); this.update({ status: 'paused' }) }
  toggle() { if (this.snapshot.status === 'playing' || this.snapshot.status === 'loading') this.pause(); else void this.play() }
  setVolume(volume: number) {
    const value = Math.max(0, Math.min(1, volume))
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.03)
    this.update({ volume: value })
  }
  seek(time: number) {
    if (!this.audio || !Number.isFinite(time) || !this.snapshot.duration) return
    this.audio.currentTime = Math.max(0, Math.min(this.snapshot.duration, time))
    this.update({ currentTime: this.audio.currentTime })
  }
  async useFile(file: File) {
    if (file.size > 50 * 1024 * 1024) throw new Error('Choose an audio file under 50 MB.')
    if (!file.size || (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name))) throw new Error('Choose an MP3, WAV, OGG, M4A, FLAC or AAC audio file.')
    this.pause()
    this.initialize()
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = URL.createObjectURL(file)
    this.audio!.src = this.objectUrl
    this.audio!.load()
    this.update({ local: true, title: file.name.replace(/\.[^.]+$/, '').slice(0, 70), currentTime: 0, duration: 0, error: '' })
    await this.play()
  }
  useOriginal() {
    this.pause()
    this.initialize()
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = null
    this.audio!.src = '/assets/track.mp3'
    this.audio!.load()
    this.update({ local: false, title: 'Inner signal', currentTime: 0, duration: 0, error: '' })
  }
  sample(delta: number) {
    let bass = 0, mid = 0, high = 0
    if (this.analyser && this.context && this.snapshot.status === 'playing') {
      this.analyser.getByteFrequencyData(this.data)
      const rate = this.context.sampleRate
      bass = bandEnergy(this.data, rate, 1024, 30, 180)
      mid = bandEnergy(this.data, rate, 1024, 180, 2500)
      high = bandEnergy(this.data, rate, 1024, 2500, 14000)
    }
    const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 9)
    this.levels.bass += (bass - this.levels.bass) * alpha
    this.levels.mid += (mid - this.levels.mid) * alpha
    this.levels.high += (high - this.levels.high) * alpha
    this.levels.average = (this.levels.bass + this.levels.mid + this.levels.high) / 3
    return this.levels
  }
  dispose() {
    this.intent++
    this.audio?.pause()
    this.audio?.removeAttribute('src')
    this.audio?.load()
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.gain?.disconnect()
    void this.context?.close()
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.audio = null; this.context = null; this.source = null; this.analyser = null; this.gain = null; this.objectUrl = null
  }
}

export const audioEngine = new AudioEngine()
if (import.meta.hot) import.meta.hot.dispose(() => audioEngine.dispose())
