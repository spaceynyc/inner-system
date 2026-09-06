import { create } from 'zustand'
import { compositionSchema, PRESETS, SHAPES, type Composition, type Quality } from '../contracts/composition'

const STORAGE_KEY = 'inner-system:studio:v1'
export type SavedComposition = { id: string; savedAt: string; composition: Composition }
type StudioState = {
  composition: Composition
  history: Composition[]
  saved: SavedComposition[]
  open: boolean
  reducedMotion: boolean
  quality: Quality
  quiet: boolean
  immersive: boolean
  notice: string
  sharedId: string | null
  set: (patch: Partial<Composition>, remember?: boolean) => void
  load: (composition: Composition) => void
  undo: () => void
  reset: () => void
  cycle: () => void
  save: () => boolean
  remove: (id: string) => void
  hydrate: () => void
  notify: (notice: string) => void
}

function persist(saved: SavedComposition[], composition: Composition) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ saved, composition }))
}

export const useStudio = create<StudioState>((set, get) => ({
  composition: { ...PRESETS[0] }, history: [], saved: [], open: false,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  quality: 'auto', quiet: false, immersive: false, notice: '', sharedId: null,
  set: (patch, remember = true) => {
    const prev = get().composition
    const next = compositionSchema.parse({ ...prev, ...patch })
    set({ composition: next, history: remember ? [...get().history.slice(-29), prev] : get().history })
  },
  load: (composition) => get().set(compositionSchema.parse(composition)),
  undo: () => {
    const history = get().history
    if (history.length) set({ composition: history[history.length - 1], history: history.slice(0, -1) })
  },
  reset: () => { get().load({ ...PRESETS[0] }); get().notify('Returned to Midnight drift.') },
  cycle: () => get().set({ shape: SHAPES[(SHAPES.indexOf(get().composition.shape) + 1) % SHAPES.length] }),
  save: () => {
    const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), composition: { ...get().composition } }
    const saved = [entry, ...get().saved].slice(0, 20)
    try {
      persist(saved, entry.composition)
      set({ saved })
      get().notify('Saved on this device.')
      return true
    } catch { get().notify('Storage is unavailable. Use a portable link to keep this composition.'); return false }
  },
  remove: (id) => {
    const saved = get().saved.filter((entry) => entry.id !== id)
    try { persist(saved, get().composition); set({ saved }); get().notify('Removed from this device.') }
    catch { get().notify('Could not update device storage.') }
  },
  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw || raw.length > 100_000) return
      const data = JSON.parse(raw) as { saved?: SavedComposition[]; composition?: unknown }
      const composition = compositionSchema.safeParse(data.composition)
      const saved = Array.isArray(data.saved) ? data.saved.filter((entry) => (
        typeof entry.id === 'string' && typeof entry.savedAt === 'string' && compositionSchema.safeParse(entry.composition).success
      )).slice(0, 20) : []
      set({ saved, ...(composition.success ? { composition: composition.data } : {}) })
    } catch { /* A damaged or disabled store must not stop the experience. */ }
  },
  notify: (notice) => set({ notice }),
}))

// Render-frequency data is deliberately separate from React subscriptions.
export const journey = { progress: 0, pointerX: 0, pointerY: 0, pulse: 0 }
