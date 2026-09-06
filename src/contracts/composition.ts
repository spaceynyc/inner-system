import { z } from 'zod'

export const compositionSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(60),
  shape: z.enum(['icosahedron', 'dodecahedron', 'octahedron']),
  palette: z.enum(['midnight', 'indigo', 'eclipse']),
  response: z.number().min(0).max(1.5),
  clarity: z.number().min(0).max(1),
  dispersion: z.number().min(0).max(1),
  orbit: z.boolean(),
  track: z.literal('inner-signal'),
}).strict()

export type Composition = z.infer<typeof compositionSchema>
export type Shape = Composition['shape']
export type Palette = Composition['palette']
export type Quality = 'auto' | 'high' | 'low'
export const SHAPES: Shape[] = ['icosahedron', 'dodecahedron', 'octahedron']
export const SHAPE_NAMES: Record<Shape, string> = {
  icosahedron: 'Icosahedron', dodecahedron: 'Dodecahedron', octahedron: 'Octahedron',
}
export const PALETTES = {
  midnight: { name: 'Midnight', color: '#7596ff', secondary: '#334bbb', description: 'Deep blue. A quiet pulse.' },
  indigo: { name: 'Indigo', color: '#a191ff', secondary: '#5634c5', description: 'Violet light. A wider orbit.' },
  eclipse: { name: 'Eclipse', color: '#ced4ec', secondary: '#343c77', description: 'Almost black. Pure refraction.' },
}

export const PRESETS: Composition[] = [
  { version: 1, name: 'Midnight drift', shape: 'icosahedron', palette: 'midnight', response: 0.7, clarity: 0.85, dispersion: 0.35, orbit: true, track: 'inner-signal' },
  { version: 1, name: 'Indigo bloom', shape: 'dodecahedron', palette: 'indigo', response: 1.15, clarity: 0.7, dispersion: 0.7, orbit: true, track: 'inner-signal' },
  { version: 1, name: 'Event horizon', shape: 'octahedron', palette: 'eclipse', response: 0.4, clarity: 0.96, dispersion: 0.15, orbit: false, track: 'inner-signal' },
]

export function encodeComposition(value: Composition): string {
  return encodeURIComponent(JSON.stringify(compositionSchema.parse(value)))
}

export function decodeComposition(value: string): Composition | null {
  if (value.length > 4096) return null
  try { return compositionSchema.parse(JSON.parse(decodeURIComponent(value))) } catch { return null }
}
