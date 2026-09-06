import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { ArrowUpRight, Circle, Download, Pause, Play, RotateCcw, Volume2, VolumeX, Waves } from 'lucide-react'
import { Dialog } from '../../ui/Dialog'
import { useStudio } from '../../state/studio'
import { captureScene } from '../../state/render'
import { gestureEngine as gesture, TAKE_SECONDS, wakeObservatory } from '../../engine/performance/GestureEngine'
import { audioEngine } from '../../engine/audio/AudioEngine'

const snapshot = () => ({ mode: gesture.mode, charge: gesture.charge, elapsed: gesture.elapsed, held: gesture.input.held, hasTake: gesture.hasTake })

export function Observatory() {
  const [status, setStatus] = useState(snapshot)
  const [still, setStill] = useState('')
  const [message, setMessage] = useState('')
  const [capturing, setCapturing] = useState(false)
  const pointerId = useRef<number | null>(null)
  const mounted = useRef(true)
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  const audio = useSyncExternalStore(audioEngine.subscribe, audioEngine.getSnapshot)
  const reduced = useStudio((s) => s.reducedMotion)
  const playing = audio.status === 'playing'
  const act = (action: () => void) => { action(); wakeObservatory(); setStatus(snapshot()) }
  useEffect(() => {
    mounted.current = true
    gesture.reset(); wakeObservatory()
    let last = performance.now(), lastEcho = gesture.echoId, ticks = 0
    const timer = window.setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000
      last = now
      if (document.hidden) return
      const active = gesture.active
      gesture.step(dt)
      if (lastEcho !== gesture.echoId) { lastEcho = gesture.echoId; audioEngine.resonate(gesture.lastPower, Math.round((gesture.input.x + 1) * 2)) }
      if (active || gesture.active) wakeObservatory()
      if (++ticks % 2 === 0) setStatus(snapshot())
    }, 50)
    const cancel = () => { gesture.cancel(); pointerId.current = null; wakeObservatory() }
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', cancel)
    return () => {
      mounted.current = false
      clearInterval(timer); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', cancel); gesture.reset(); wakeObservatory()
      queueMicrotask(() => {
        const target = returnFocus.current
        if (target?.isConnected && target.getBoundingClientRect().width) target.focus({ preventScroll: true })
        else document.querySelector<HTMLButtonElement>('.silent-entry')?.focus({ preventScroll: true })
      })
    }
  }, [])
  useEffect(() => () => { if (still) URL.revokeObjectURL(still) }, [still])
  const point = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    gesture.point((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1)
  }
  async function capture() {
    if (!captureScene.current) { setMessage('The sculpture is still arriving. Try again in a moment.'); return }
    setCapturing(true)
    try {
      const blob = await captureScene.current()
      if (!mounted.current) return
      setStill(URL.createObjectURL(blob)); setMessage('Your still is ready. Download it below.')
    }
    catch { if (mounted.current) setMessage('This device could not capture the sculpture. Please try again.') }
    finally { if (mounted.current) setCapturing(false) }
  }
  return <Dialog open title="The Observatory" onClose={() => useStudio.setState({ observatory: false })} className="observatory">
    <div className="observatory-frame" aria-hidden="true" />
    <div className="observatory-intro"><span className="micro">A STUDY IN ATTRACTION / 001</span><h3>Move the <em>invisible.</em></h3><p>Drag to turn. Hold to unfold. Release to echo.</p></div>
    <div className={`gesture-surface ${status.held ? 'is-held' : ''}`} tabIndex={0} role="group" aria-label="Sculpture gesture field. Hold and drag to unfold. Use arrow keys to turn, or the Open form and Send echo buttons below."
      onPointerDown={(event) => { if (pointerId.current !== null || event.button !== 0) return; pointerId.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); point(event); act(() => gesture.hold()) }}
      onPointerMove={(event) => { if (pointerId.current === event.pointerId) { point(event); wakeObservatory() } }}
      onPointerUp={(event) => { if (pointerId.current !== event.pointerId) return; point(event); pointerId.current = null; act(() => gesture.release()); event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={() => { pointerId.current = null; act(() => gesture.cancel()) }}
      onLostPointerCapture={() => { if (pointerId.current !== null) { pointerId.current = null; act(() => gesture.cancel()) } }}
      onKeyDown={(event) => {
        const moves: Record<string, [number, number]> = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }
        if (moves[event.key]) { event.preventDefault(); const [x, y] = moves[event.key]; act(() => { if (gesture.mode === 'replaying') gesture.stop(); gesture.point(gesture.input.x + x, gesture.input.y + y) }) }
      }}>
      <div className="field-reticle" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>
    <aside className="observatory-reading" aria-hidden="true"><span>ATTRACTION</span><strong>{String(Math.round(status.charge * 100)).padStart(3, '0')}<small>%</small></strong><div><i style={{ transform: `scaleY(${Math.max(0.015, status.charge)})` }} /></div><span>{status.held ? 'FIELD OPEN' : 'AWAITING GESTURE'}</span></aside>
    <div className="observatory-console">
      <div className="take-status"><span className={`take-light ${status.mode}`} /><span role="status">{status.mode === 'recording' ? 'Capturing your movement' : status.mode === 'replaying' ? 'Your gesture, in orbit' : 'The field is yours'}</span><span className="take-time">{status.mode === 'live' ? 'LIVE' : `${status.elapsed.toFixed(1)} / ${TAKE_SECONDS}.0 s`}</span></div>
      <div className="take-timeline" aria-hidden="true"><i style={{ transform: `scaleX(${status.mode === 'live' ? 0 : status.elapsed / TAKE_SECONDS})` }} /></div>
      <div className="observatory-controls">
        <button className="echo-button" onClick={() => act(() => { if (gesture.mode === 'replaying') gesture.stop(); gesture.strike() })}><Waves size={18} />Send an echo</button>
        <button aria-pressed={status.held} onClick={() => act(() => status.held ? gesture.release() : gesture.hold())}>{status.held ? 'Release form' : 'Open form'}<ArrowUpRight size={15} /></button>
        <span className="console-divider" />
        <button disabled={status.mode === 'recording'} onClick={() => act(() => gesture.record())}><Circle size={12} />{status.mode === 'recording' ? 'Recording…' : 'Record 8 seconds'}</button>
        <button disabled={!status.hasTake} onClick={() => act(() => status.mode === 'replaying' ? gesture.stop() : gesture.replay())}>{status.mode === 'replaying' ? <Pause size={15} /> : <Play size={15} />}{status.mode === 'replaying' ? 'Stop loop' : 'Replay gesture'}</button>
      </div>
      <div className="observatory-utility"><button onClick={() => audioEngine.toggle()}>{playing ? <Volume2 size={14} /> : <VolumeX size={14} />}{playing ? 'Sound on' : audio.status === 'loading' ? 'Starting sound…' : 'Enable sound'}</button><button onClick={() => void capture()} disabled={capturing}><Download size={14} />{capturing ? 'Capturing…' : 'Keep a still'}</button><button onClick={() => act(() => gesture.reset())}><RotateCcw size={13} />Reset field</button><button aria-pressed={reduced} onClick={() => useStudio.setState({ reducedMotion: !reduced })}>{reduced ? 'Reduced motion' : 'Full motion'}</button></div>
      <p className="observatory-note">{status.mode === 'recording' ? 'Make your gesture. Replay begins after eight seconds.' : 'An eight-second memory of movement. This take stays here until you leave.'}</p>
      {(message || audio.error) && <p className="observatory-message" role="status">{audio.error || message}</p>}
    </div>
    {still && <a className="observatory-still" href={still} download="inner-system-observatory.png"><img src={still} alt="Captured glass composition" /><span>Download still <Download size={13} /></span></a>}
  </Dialog>
}
