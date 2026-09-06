import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Pause, Play, SlidersHorizontal, Volume2, VolumeX, ChevronUp, ChevronDown } from 'lucide-react'
import { audioEngine } from '../../engine/audio/AudioEngine'
import { useStudio } from '../../state/studio'

function formatTime(seconds: number) {
  const value = Math.floor(Number.isFinite(seconds) ? seconds : 0)
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

function SignalMeter() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || !ref.current) return
      const values = [audioEngine.levels.bass, audioEngine.levels.mid, audioEngine.levels.high]
      Array.from(ref.current.children).forEach((node, i) => {
        (node as HTMLElement).style.transform = `scaleY(${0.12 + values[i % 3] * (0.65 + Math.sin(i * 2.3) * 0.3)})`
      })
    }, 80)
    return () => clearInterval(timer)
  }, [])
  return <div className="signal-meter" ref={ref} aria-hidden="true">{Array.from({ length: 17 }, (_, i) => <i key={i} />)}</div>
}

export function Transport({ visible }: { visible: boolean }) {
  const audio = useSyncExternalStore(audioEngine.subscribe, audioEngine.getSnapshot)
  const [expanded, setExpanded] = useState(false)
  const playing = audio.status === 'playing' || audio.status === 'loading'
  const open = useStudio((s) => s.open)
  return <aside className={`transport ${visible && !open ? 'is-visible' : ''} ${expanded ? 'is-expanded' : ''}`} aria-label="Audio player" inert={!visible || open}>
    <button className="transport-play icon-button" aria-label={playing ? 'Pause sound' : 'Play sound'} onClick={() => audioEngine.toggle()}>
      {playing ? <Pause size={18} /> : <Play size={18} />}
    </button>
    <div className="track-info"><span className="micro">{audio.local ? 'YOUR SIGNAL' : 'ORIGINAL SIGNAL'}</span><span className="track-name">{audio.title}</span></div>
    <SignalMeter />
    <div className="transport-seek"><label className="sr-only" htmlFor="track-progress">Track position</label>
      <input id="track-progress" type="range" min="0" max={audio.duration || 1} step="0.1" value={audio.currentTime} disabled={!audio.duration} onChange={(e) => audioEngine.seek(Number(e.target.value))} />
      <span>{formatTime(audio.currentTime)} / {formatTime(audio.duration)}</span>
    </div>
    <div className="transport-volume"><button className="icon-button" aria-label={audio.volume ? 'Mute sound' : 'Unmute sound'} onClick={() => audioEngine.setVolume(audio.volume ? 0 : 0.55)}>{audio.volume ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
      <input type="range" aria-label="Volume" min="0" max="1" step="0.01" value={audio.volume} onChange={(e) => audioEngine.setVolume(Number(e.target.value))} />
    </div>
    <button className="icon-button transport-studio" aria-label="Open instrument" onClick={() => useStudio.setState({ open: true })}><SlidersHorizontal size={17} /></button>
    <button className="icon-button transport-expand" aria-label={expanded ? 'Collapse player' : 'Expand player'} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>
  </aside>
}
