import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Maximize2, Minimize2, Pause, Play, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react'
import { audioEngine } from './engine/audio/AudioEngine'
import { Instrument } from './features/studio/Instrument'
import { Transport } from './features/audio/Transport'
import { Dialog } from './ui/Dialog'
import { journey, useStudio } from './state/studio'
import { compositionSchema, decodeComposition, PALETTES, SHAPES, SHAPE_NAMES } from './contracts/composition'

const Scene = lazy(() => import('./engine/scene/Scene'))
const CHAPTERS = ['Arrival', 'Resonance', 'Refraction', 'Release']

export default function App() {
  const [ready, setReady] = useState(false)
  const [chapter, setChapter] = useState(0)
  const [about, setAbout] = useState(false)
  const [help, setHelp] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const sections = useRef<(HTMLElement | null)[]>([])
  const audio = useSyncExternalStore(audioEngine.subscribe, audioEngine.getSnapshot)
  const composition = useStudio((s) => s.composition)
  const open = useStudio((s) => s.open)
  const immersive = useStudio((s) => s.immersive)
  const reduced = useStudio((s) => s.reducedMotion)
  const notice = useStudio((s) => s.notice)
  const playing = audio.status === 'playing' || audio.status === 'loading'
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    useStudio.getState().hydrate()
    let cancelled = false
    const loadLocation = async () => {
      const hash = location.hash
      if (hash.startsWith('#preset=')) {
        const value = decodeComposition(hash.slice(8))
        if (value) { useStudio.getState().load(value); useStudio.setState({ open: true }); useStudio.getState().notify('Portable composition opened. Audio starts when you press play.') }
        else useStudio.getState().notify('This composition link is incomplete or unsupported.')
        return
      }
      const id = new URLSearchParams(location.search).get('composition')
      if (id && /^[a-zA-Z0-9_-]{12,40}$/.test(id)) {
        try {
          const response = await fetch(`/api/compositions/${id}`, { signal: AbortSignal.timeout(8000) })
          if (!response.ok) throw new Error(response.status === 404 ? 'This composition is no longer available.' : 'The composition could not be loaded. Please retry.')
          const data = await response.json() as { composition: unknown }
          const config = compositionSchema.parse(data.composition)
          if (!cancelled) { useStudio.getState().load(config); useStudio.setState({ open: true, sharedId: id }); useStudio.getState().notify(`Opened ${config.name}.`) }
        } catch (error) { if (!cancelled) useStudio.getState().notify(error instanceof Error ? error.message : 'Could not open composition.') }
      }
    }
    void loadLocation()
    window.addEventListener('hashchange', loadLocation)
    window.addEventListener('popstate', loadLocation)
    return () => { cancelled = true; window.removeEventListener('hashchange', loadLocation); window.removeEventListener('popstate', loadLocation) }
  }, [])
  useEffect(() => {
    const update = () => {
      const tops = sections.current.map((element) => element ? element.getBoundingClientRect().top + window.scrollY : 0)
      let index = 0
      for (let i = 0; i < tops.length; i++) if (window.scrollY >= tops[i] - 1) index = i
      const next = tops[Math.min(index + 1, 3)]
      const fraction = index === 3 ? 0 : Math.max(0, Math.min(1, (window.scrollY - tops[index]) / Math.max(1, next - tops[index])))
      journey.progress = Math.min(3, index + fraction)
      setChapter(Math.min(3, Math.round(journey.progress)))
      if (progress.current) progress.current.style.transform = `scaleX(${(journey.progress + 1) / 4})`
    }
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      journey.pointerX = event.clientX / window.innerWidth * 2 - 1
      journey.pointerY = event.clientY / window.innerHeight * 2 - 1
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    window.addEventListener('pointermove', pointer, { passive: true })
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); window.removeEventListener('pointermove', pointer) }
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input,textarea,select,[contenteditable="true"],dialog')) return
      const state = useStudio.getState()
      if (event.key.toLowerCase() === 'm') { state.cycle(); journey.pulse = 1 }
      if (event.code === 'Space' && !target.closest('button,a')) { event.preventDefault(); audioEngine.toggle(); setHasEntered(true) }
      if (event.key.toLowerCase() === 'i') useStudio.setState({ open: !state.open })
      if (event.key === '?') setHelp(true)
      if (event.key === 'Escape') useStudio.setState({ immersive: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => useStudio.setState({ notice: '' }), 6500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => useStudio.setState({ reducedMotion: query.matches })
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const changed = () => { if (!document.fullscreenElement) useStudio.setState({ immersive: false }) }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])

  const go = (index: number) => {
    const section = sections.current[index]
    if (!section) return
    history.pushState(null, '', `#${section.id}`)
    section.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' })
  }
  async function enter() { setHasEntered(true); journey.pulse = 1; if (playing) audioEngine.pause(); else await audioEngine.play() }
  async function fullScreen() {
    if (immersive) { useStudio.setState({ immersive: false }); if (document.fullscreenElement) await document.exitFullscreen(); return }
    useStudio.setState({ immersive: true })
    try { await root.current?.requestFullscreen?.() } catch { /* Immersive layout remains available without browser fullscreen. */ }
  }

  return <div ref={root} className={`app ${ready ? 'is-ready' : ''} ${open ? 'is-studio' : ''} ${immersive ? 'is-immersive' : ''} ${reduced ? 'reduced-motion' : ''}`} style={{ '--accent': PALETTES[composition.palette].color, '--accent-deep': PALETTES[composition.palette].secondary } as React.CSSProperties}>
    <a className="skip-link" href="#main">Skip to experience</a>
    <div className="atmosphere" aria-hidden="true"><div className="atmosphere-light" /><div className="chamber-line line-one" /><div className="chamber-line line-two" /></div>
    <Suspense fallback={null}><Scene onReady={onReady} /></Suspense>
    <header className="site-header" inert={immersive}>
      <a className="wordmark" href="#arrival" aria-label="The Inner System — beginning" onClick={(e) => { e.preventDefault(); useStudio.setState({ open: false }); go(0) }}><svg className="brand-symbol" width="28" height="31" viewBox="0 0 28 31" fill="none" aria-hidden="true"><path d="M14 1 27 8v15l-13 7L1 23V8L14 1Zm0 0v29M1 8l26 15M27 8 1 23" stroke="currentColor" strokeWidth=".8" /></svg><span>THE INNER SYSTEM</span></a>
      <nav aria-label="Main navigation"><a href="#resonance" onClick={(e) => { e.preventDefault(); go(1) }}>Experience</a><button onClick={() => useStudio.setState({ open: true })}>Studio <ArrowUpRight size={13} /></button><button onClick={() => setAbout(true)}>About</button></nav>
      <button className="header-sound" onClick={() => { audioEngine.toggle(); setHasEntered(true) }} aria-label={playing ? 'Pause audio signal' : 'Start audio signal'}>{playing ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>{playing ? 'SOUND ON' : 'SOUND OFF'}</span></button>
    </header>
    <main id="main" className="journey-content" inert={open || immersive}>
      <section ref={(el) => { sections.current[0] = el }} id="arrival" className="chapter chapter-arrival" aria-labelledby="hero-title">
        <div className="chapter-copy hero-copy"><p className="eyebrow"><span className="signal-dot" />01 — ARRIVAL</p>
          <h1 id="hero-title"><span>SOUND</span><span>TAKES</span><span>SHAPE<span className="title-dot">.</span></span></h1>
          <p className="hero-subtitle">An instrument made of light.</p>
          <div className="entry-actions"><button className="enter-button" onClick={() => void enter()}><span className="play-circle">{playing ? <Pause size={25} strokeWidth={1.2} /> : <Play size={25} strokeWidth={1.2} />}</span><span>{playing ? 'You’re in the signal' : 'Enter with sound'}<small>{playing ? 'Scroll to explore' : 'Headphones recommended'}</small></span><ArrowUpRight size={18} className="entry-arrow" /></button><button className="silent-entry" onClick={() => { setHasEntered(true); go(1) }}>Explore silently <ArrowRight size={14} /></button></div>
        </div>
        <div className="object-caption"><span className="caption-line" /><div><span className="micro">FORM 0{SHAPES.indexOf(composition.shape) + 1}</span><span>{SHAPE_NAMES[composition.shape]}</span></div><button onClick={() => { useStudio.getState().cycle(); journey.pulse = 1 }} aria-label="Change sculpture form">Change form <ArrowUpRight size={12} /></button></div>
        <div className="chapter-bottom"><span className="micro">AN AUDIOVISUAL EXPLORATION</span><button onClick={() => go(1)}>SCROLL TO EXPLORE <ArrowDown size={15} /></button><span className="micro">EST. IN THE IN-BETWEEN</span></div>
      </section>
      <section ref={(el) => { sections.current[1] = el }} id="resonance" className="chapter chapter-resonance" aria-labelledby="resonance-title"><div className="chapter-copy">
        <p className="eyebrow">02 — RESONANCE</p><h2 id="resonance-title">LISTEN<br /> WITH YOUR<br /><em>EYES.</em></h2>
        <p className="chapter-description">A low note moves the surface.<br />A high note catches the light.<br />Every frequency leaves a trace.</p>
        <button className="underline-button" onClick={() => { audioEngine.toggle(); setHasEntered(true) }}>{playing ? 'Pause. Feel the difference.' : 'Let the signal in.'}{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <div className="band-key"><span><i />Bass <small>Mass</small></span><span><i />Mids <small>Motion</small></span><span><i />Highs <small>Light</small></span></div>
      </div></section>
      <section ref={(el) => { sections.current[2] = el }} id="refraction" className="chapter chapter-refraction" aria-labelledby="refraction-title"><div className="chapter-copy">
        <p className="eyebrow">03 — REFRACTION</p><h2 id="refraction-title">NOTHING<br /> STAYS<br /><em>STILL.</em></h2><p className="chapter-description">One signal. Three ways to feel it.<br />Find the form that feels like you.</p>
        <div className="chapter-forms">{SHAPES.map((shape, i) => <button key={shape} aria-pressed={shape === composition.shape} onClick={() => { useStudio.getState().set({ shape }); journey.pulse = 1 }}><span>0{i + 1}</span>{SHAPE_NAMES[shape]}<ArrowUpRight size={15} /></button>)}</div>
        <span className="micro keyboard-hint">OR PRESS <kbd>M</kbd> TO TRANSFORM</span>
      </div></section>
      <section ref={(el) => { sections.current[3] = el }} id="release" className="chapter chapter-release" aria-labelledby="release-title"><div className="chapter-copy">
        <p className="eyebrow">04 — RELEASE</p><h2 id="release-title">YOUR<br /><em>FREQUENCY.</em></h2><p className="chapter-description">Some things are better felt than explained.<br />Make a small universe of your own.</p>
        <button className="primary-button release-button" onClick={() => useStudio.setState({ open: true })}>Make it yours <ArrowUpRight size={19} /></button><button className="text-button immersion-button" onClick={() => void fullScreen()}><Maximize2 size={15} />Disappear into the signal</button>
      </div><footer className="experience-footer"><span>THE INNER SYSTEM</span><button onClick={() => setAbout(true)}>An experiment in sound & form</button><button onClick={() => go(0)}>Back to the beginning ↑</button></footer></section>
    </main>
    <div className="chapter-rail" inert={open || immersive} aria-label="Chapter navigation"><span className="chapter-number">0{chapter + 1}<span> / 04</span></span><div className="journey-progress"><div ref={progress} /></div><span className="rail-title">{CHAPTERS[chapter]}</span><button onClick={() => setHelp(true)} aria-label="Keyboard shortcuts">?</button></div>
    <button className="floating-instrument" inert={open || immersive} aria-label="Open the instrument" onClick={() => useStudio.setState({ open: true })}><SlidersHorizontal size={15} /><span>THE INSTRUMENT</span></button>
    <Transport visible={hasEntered || chapter > 0 || audio.status !== 'idle'} />
    <Instrument />
    <button className="exit-immersive icon-button" onClick={() => void fullScreen()} aria-label="Exit immersive mode"><Minimize2 size={20} /></button>
    {!ready && <div className="scene-loading" role="status"><i />Bringing light into the system</div>}
    {audio.status === 'error' && <div className="audio-error" role="alert"><span>{audio.error}</span><button onClick={() => void audioEngine.play()}>Retry</button></div>}
    <div className={`notice ${notice && !open ? 'visible' : ''}`} role="status" aria-live="polite" inert={!notice || open}>{!open && notice}<button aria-label="Dismiss notification" onClick={() => useStudio.setState({ notice: '' })}><X size={15} /></button></div>
    <Dialog open={about} onClose={() => setAbout(false)} title="The space between" className="about-dialog"><p className="about-lead">Sound becomes form.<br />Light becomes feeling.</p><p>The Inner System is an interactive study of the invisible: frequencies, reflections, and the moments in between. A small universe that moves with your music.</p><p>Three glass forms. One living signal. Nothing to get right. Just something to feel.</p><div className="about-credit"><span className="micro">THE ORIGINAL SIGNAL</span><p>The soundtrack carried over from the original Inner System. Bring your own audio through the instrument; it stays on your device.</p></div><button className="primary-button" onClick={() => { setAbout(false); useStudio.setState({ open: true }) }}>Explore the instrument <ArrowUpRight size={17} /></button></Dialog>
    <Dialog open={help} onClose={() => setHelp(false)} title="Find your way"><dl className="shortcut-list"><div><dt><kbd>Space</kbd></dt><dd>Play / pause</dd></div><div><dt><kbd>M</kbd></dt><dd>Change form</dd></div><div><dt><kbd>I</kbd></dt><dd>Open the instrument</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Close a panel / exit immersion</dd></div></dl><p className="field-note">All actions are also available through visible controls. Adjust motion and visual intensity in the instrument.</p></Dialog>
  </div>
}
