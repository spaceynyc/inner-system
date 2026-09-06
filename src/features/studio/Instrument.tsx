import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowUpRight, Check, Copy, Download, Link, LoaderCircle, Pause, Play, RotateCcw, Save, Trash2, Undo2, Upload } from 'lucide-react'
import { Dialog } from '../../ui/Dialog'
import { PALETTES, PRESETS, SHAPES, SHAPE_NAMES, encodeComposition, type Composition, type Quality } from '../../contracts/composition'
import { useStudio } from '../../state/studio'
import { audioEngine } from '../../engine/audio/AudioEngine'
import { captureScene } from '../../state/render'

type OwnedLink = { id: string; token: string; name: string }
const OWNED_LINKS = 'inner-system:owned-links:v1'
function readOwned(): OwnedLink[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(OWNED_LINKS) ?? '[]')
    return Array.isArray(raw) ? raw.filter((entry): entry is OwnedLink => typeof entry?.id === 'string' && /^[\w-]{16}$/.test(entry.id) && typeof entry.token === 'string' && typeof entry.name === 'string').slice(0, 20) : []
  } catch { return [] }
}

function Range({ label, value, max = 1, onChange }: { label: string; value: number; max?: number; onChange: (value: number) => void }) {
  const started = useRef(false)
  return <label className="studio-range"><span>{label}<output>{Math.round(value * 100)}%</output></span>
    <input type="range" aria-label={label} min="0" max={max} step="0.01" value={value}
      onPointerDown={() => { started.current = false }}
      onChange={(event) => { if (!started.current) { const state = useStudio.getState(); useStudio.setState({ history: [...state.history.slice(-29), state.composition] }); started.current = true } onChange(Number(event.target.value)) }}
      onKeyUp={() => { started.current = false }} /></label>
}

function CompositionName({ name }: { name: string }) {
  const [empty, setEmpty] = useState(false)
  return <input id="composition-name" className="text-input" maxLength={60} value={empty ? '' : name}
    onChange={(event) => { const value = event.target.value; setEmpty(!value.trim()); if (value.trim()) useStudio.getState().set({ name: value }, false) }}
    onBlur={() => setEmpty(false)} />
}

export function Instrument() {
  const state = useStudio()
  const audio = useSyncExternalStore(audioEngine.subscribe, audioEngine.getSnapshot)
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'shape' | 'collection'>('shape')
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareKind, setShareKind] = useState<'server' | 'portable'>('portable')
  const [shareId, setShareId] = useState('')
  const [deleteToken, setDeleteToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState('')
  useEffect(() => () => { if (exportUrl) URL.revokeObjectURL(exportUrl) }, [exportUrl])
  const [owned, setOwned] = useState<OwnedLink[]>(readOwned)
  const current = state.composition
  const update = (patch: Partial<Composition>) => state.set(patch)
  function remember(links: OwnedLink[]) {
    setOwned(links)
    try { sessionStorage.setItem(OWNED_LINKS, JSON.stringify(links)) } catch { state.notify('Keep this tab open to manage your share link.') }
  }

  async function share() {
    setSharing(true); setCopied(false)
    const portable = `${location.origin}/#preset=${encodeComposition(current)}`
    try {
      const response = await fetch('/api/compositions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(current), signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw new Error('Sharing is unavailable')
      const data = await response.json() as { id: string; deleteToken: string }
      setShareUrl(`${location.origin}/s/${data.id}`); setShareId(data.id); setDeleteToken(data.deleteToken); setShareKind('server')
      remember([{ id: data.id, token: data.deleteToken, name: current.name }, ...owned].slice(0, 20))
      state.notify('Unlisted link created. Anyone with it can open this composition.')
    } catch {
      setShareUrl(portable); setShareKind('portable'); setShareId(''); setDeleteToken('')
      state.notify('Share storage is unavailable. This portable link contains your settings and still works.')
    } finally { setSharing(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true) }
    catch { state.notify('Select and copy the link below.') }
  }
  async function revoke(id = shareId, token = deleteToken) {
    try {
      const response = await fetch(`/api/compositions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('Could not revoke')
      if (id === shareId) setShareUrl('')
      remember(owned.filter((link) => link.id !== id)); state.notify('Share link revoked. Local saves are unchanged.')
    } catch { state.notify('Could not revoke the link. Please try again.') }
  }
  async function exportImage() {
    setExporting(true)
    try {
      if (!captureScene.current) throw new Error('Wait for the sculpture to finish loading.')
      const blob = await captureScene.current()
      const url = URL.createObjectURL(blob)
      setExportUrl(url)
      state.notify('Your image is ready. Download it below.')
    } catch (error) { state.notify(error instanceof Error ? error.message : 'Image export was unsuccessful.') }
    finally { setExporting(false) }
  }

  return <Dialog open={state.open} onClose={() => useStudio.setState({ open: false })} title="The instrument" className="instrument">
    {state.notice && <p className="instrument-notice" role="status">{state.notice}</p>}
    <p className="instrument-intro">A little less watching.<br />A little more becoming.</p>
    <div className="studio-tabs" role="tablist" aria-label="Instrument view">
      <button role="tab" id="shape-tab" aria-selected={tab === 'shape'} aria-controls="shape-panel" onClick={() => setTab('shape')}>Compose</button>
      <button role="tab" id="collection-tab" aria-selected={tab === 'collection'} aria-controls="collection-panel" onClick={() => setTab('collection')}>Collection <span>{state.saved.length}</span></button>
    </div>
    <div id="shape-panel" role="tabpanel" aria-labelledby="shape-tab" hidden={tab !== 'shape'}>
      <fieldset className="studio-field"><legend><span>01</span> Geometry</legend>
        <div className="shape-choices">{SHAPES.map((shape, i) => <button key={shape} className={shape === current.shape ? 'selected' : ''} aria-pressed={shape === current.shape} onClick={() => update({ shape })}>
          <span className={`form-glyph glyph-${i}`} aria-hidden="true">{['◇', '⬡', '△'][i]}</span><span>{SHAPE_NAMES[shape]}</span>
        </button>)}</div>
      </fieldset>
      <fieldset className="studio-field"><legend><span>02</span> Atmosphere</legend>
        <div className="palette-choices">{Object.entries(PALETTES).map(([key, palette]) => <button key={key} aria-pressed={current.palette === key} className={current.palette === key ? 'selected' : ''} onClick={() => update({ palette: key as Composition['palette'] })}>
          <i style={{ background: `radial-gradient(circle at 35% 25%, ${palette.color}, ${palette.secondary} 45%, #03040a 80%)` }} />{palette.name}
        </button>)}</div>
      </fieldset>
      <fieldset className="studio-field"><legend><span>03</span> Light & response</legend>
        <Range label="Response" value={current.response} max={1.5} onChange={(response) => state.set({ response }, false)} />
        <Range label="Clarity" value={current.clarity} onChange={(clarity) => state.set({ clarity }, false)} />
        <Range label="Dispersion" value={current.dispersion} onChange={(dispersion) => state.set({ dispersion }, false)} />
        <label className="check-line"><span>Orbital trace</span><input type="checkbox" checked={current.orbit} onChange={(e) => update({ orbit: e.target.checked })} /></label>
      </fieldset>
      <fieldset className="studio-field"><legend><span>04</span> Your signal</legend>
        <div className="studio-audio"><button className="icon-button" onClick={() => audioEngine.toggle()} aria-label={audio.status === 'playing' ? 'Pause audio' : 'Play audio'}>{audio.status === 'playing' ? <Pause size={17} /> : <Play size={17} />}</button><span>{audio.title}</span><button className="icon-button" onClick={() => fileRef.current?.click()} aria-label="Choose local audio"><Upload size={17} /></button></div>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac" className="sr-only" aria-label="Local audio file" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { try { await audioEngine.useFile(file) } catch (error) { state.notify((error as Error).message) } } event.target.value = '' }} />
        <p className="field-note">Your audio stays on this device. Up to 50 MB.</p>
        {audio.local && <button className="text-button" onClick={() => audioEngine.useOriginal()}>Return to original signal</button>}
      </fieldset>
      <div className="studio-field"><label className="field-label" htmlFor="composition-name">Name your composition</label><CompositionName key={`${current.shape}-${current.palette}-${state.history.length}`} name={current.name} /></div>
      <div className="studio-actions"><button className="primary-button" onClick={state.save}><Save size={16} />Save to collection</button><button className="icon-button" aria-label="Undo last change" disabled={!state.history.length} onClick={state.undo}><Undo2 size={17} /></button><button className="icon-button" aria-label="Reset composition" onClick={state.reset}><RotateCcw size={17} /></button></div>
      <div className="secondary-actions"><button className="text-button" disabled={sharing} onClick={() => void share()}>{sharing ? <LoaderCircle className="spin" size={16} /> : <Link size={16} />}Create a link</button><button className="text-button" disabled={exporting} onClick={() => void exportImage()}><Download size={16} />Export image</button></div>
      {shareUrl && <div className="share-result"><label htmlFor="share-link">{shareKind === 'server' ? 'Unlisted composition' : 'Portable composition'}</label><div><input id="share-link" readOnly value={shareUrl} onFocus={(e) => e.target.select()} /><button className="icon-button" aria-label="Copy composition link" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div><p>{audio.local ? 'Settings only. The recipient chooses their own audio.' : 'Anyone with this link can open your settings.'}</p>{shareKind === 'server' && <button className="text-button" onClick={() => void revoke()}>Revoke this link</button>}</div>}
    </div>
    <div id="collection-panel" role="tabpanel" aria-labelledby="collection-tab" hidden={tab !== 'collection'}>
      <span className="micro collection-label">CURATED FREQUENCIES</span>
      {PRESETS.map((preset, i) => <button className="preset-row" key={preset.name} onClick={() => { state.load(preset); setTab('shape'); state.notify(`Loaded ${preset.name}.`) }}><span className="preset-index">0{i + 1}</span><span><strong>{preset.name}</strong><small>{PALETTES[preset.palette].description}</small></span><ArrowUpRight size={19} /></button>)}
      <span className="micro collection-label">SAVED ON THIS DEVICE</span>
      {!state.saved.length && <p className="empty-collection">Your collection starts with a feeling.<br />Shape something, then save it here.</p>}
      {state.saved.map((saved) => <div className="saved-row" key={saved.id}><button onClick={() => { state.load(saved.composition); setTab('shape'); state.notify('Composition restored.') }}><strong>{saved.composition.name}</strong><small>{SHAPE_NAMES[saved.composition.shape]} · {PALETTES[saved.composition.palette].name}</small></button><button className="icon-button" aria-label={`Remove ${saved.composition.name}`} onClick={() => state.remove(saved.id)}><Trash2 size={15} /></button></div>)}
      {!!owned.length && <><span className="micro collection-label">LINKS FROM THIS SESSION</span><p className="field-note">Unlisted links expire after 90 days. Revoke them here before closing this browser session.</p>{owned.map((link) => <div className="saved-row" key={link.id}><a href={`/s/${link.id}`} target="_blank" rel="noreferrer"><strong>{link.name}</strong><small>Open shared composition ↗</small></a><button className="icon-button" aria-label={`Revoke ${link.name} link`} onClick={() => void revoke(link.id, link.token)}><Trash2 size={15} /></button></div>)}</>}
    </div>
    {exportUrl && <div className="export-result"><img src={exportUrl} alt="Your exported sculpture" /><a className="text-button" href={exportUrl} download={`inner-system-${current.shape}.png`}><Download size={16} />Download PNG</a></div>}
    <details className="studio-settings"><summary>Comfort & performance</summary>
      <label className="check-line"><span>Reduce motion</span><input type="checkbox" checked={state.reducedMotion} onChange={(e) => useStudio.setState({ reducedMotion: e.target.checked })} /></label>
      <label className="check-line"><span>Reduce intensity</span><input type="checkbox" checked={state.quiet} onChange={(e) => useStudio.setState({ quiet: e.target.checked })} /></label>
      <label className="check-line"><span>Visual quality</span><select value={state.quality} onChange={(e) => useStudio.setState({ quality: e.target.value as Quality })}><option value="auto">Automatic</option><option value="high">High</option><option value="low">Light</option></select></label>
    </details>
  </Dialog>
}
