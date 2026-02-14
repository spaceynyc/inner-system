# Inner System — Halftone Post-Processing Spec

## Overview

Add a halftone shader as an optional post-processing effect to inner-system. The effect should be **audio-reactive** and **scroll-driven**, matching the existing design language where every visual parameter responds to sound and scroll position.

The halftone acts as a creative layer that transforms the clean 3D scene into something that feels printed, textured, and alive — dots that breathe with the music.

## Architecture

### Where It Lives

- **New file:** `src/shaders/HalftoneEffect.js` — custom `postprocessing` Effect class
- **New file:** `src/shaders/halftone.frag` (or inline GLSL string) — the fragment shader
- **Modified:** `src/components/Effects.jsx` — add `<HalftoneEffect>` to the EffectComposer
- **Modified:** `src/audioState.js` — no changes needed (already exposes bass, high, average)
- **Modified:** `src/scrollState.js` — no changes needed (already exposes offset)

### Integration with EffectComposer

The halftone effect slots into the existing `@react-three/postprocessing` EffectComposer chain. It should run **after** Bloom but **before** Noise and Vignette so bloom glow gets halftoned but film grain sits on top.

```jsx
<EffectComposer multisampling={0}>
    <Bloom ... />
    {gpuTier >= 2 && <HalftonePass ref={halftoneRef} />}  {/* NEW */}
    {gpuTier >= 2 && <ChromaticAberration ... />}
    {gpuTier >= 2 && <Noise ... />}
    <Vignette ... />
</EffectComposer>
```

### Custom Effect Class

Use the `postprocessing` library's `Effect` base class (same pattern as the existing effects). This gives us uniform control and composability for free.

```js
import { Effect } from 'postprocessing'
import { Uniform, Vector2 } from 'three'

const fragmentShader = `...` // see Shader section

export class HalftoneEffect extends Effect {
  constructor({
    gridSize = 48.0,
    radius = 0.4,
    softness = 0.02,
    mode = 0,        // 0=dot, 1=ring, 2=dot+square
    stagger = true,
    colorMode = 0,   // 0=color, 1=luma/mono
  } = {}) {
    super('HalftoneEffect', fragmentShader, {
      uniforms: new Map([
        ['uGridSize', new Uniform(gridSize)],
        ['uRadius', new Uniform(radius)],
        ['uSoftness', new Uniform(softness)],
        ['uMode', new Uniform(mode)],
        ['uStagger', new Uniform(stagger ? 1.0 : 0.0)],
        ['uColorMode', new Uniform(colorMode)],
        ['uResolution', new Uniform(new Vector2())],
      ]),
    })
  }
}
```

## Shader

### Core Algorithm

1. **Pixelate** the input texture to match the dot grid (floor-based UV snapping)
2. **Compute luma** from the pixelated sample: `dot(vec3(0.2126, 0.7152, 0.0722), color.rgb)`
3. **Scale dot radius** by luma — brighter pixels = larger dots
4. **Draw shape** per cell using distance field + smoothstep mask
5. **Mix** dot color with background (black by default)

### Uniforms (animated at runtime)

| Uniform | Type | Driven By | Purpose |
|---------|------|-----------|---------|
| `uGridSize` | float | scroll + audio average | Dot density. Smaller grid = more dots = more detail |
| `uRadius` | float | audio bass | Base dot radius. Bass hits make dots swell |
| `uSoftness` | float | static | Smoothstep edge width. Lower = crisp, higher = soft |
| `uMode` | int | scroll section | 0=dot, 1=ring, 2=dot+square hybrid |
| `uStagger` | float | static | Row offset for honeycomb layout |
| `uColorMode` | int | user toggle | 0=colored (sample texture), 1=monochrome (luma only) |
| `uResolution` | vec2 | canvas resize | For aspect-correct grid cells |

### Variant: Ring Mode

Two concentric circles, subtract inner from outer:

```glsl
float outerCircle = smoothstep(radius - softness, radius + softness, dist);
float innerCircle = smoothstep(innerR - softness, innerR + softness, dist);
float ring = innerCircle * (1.0 - outerCircle);
```

### Variant: Dot + Square Hybrid

Mix based on luma threshold:
- Luma < 0.4 → colored square with white dot cutout (dark areas)
- Luma ≥ 0.4 → standard colored dot on black (bright areas)

This preserves more visual information in shadows.

### Staggered Grid

Every other row gets a half-cell X offset:

```glsl
float rowIndex = floor(uv.y / cellSize.y);
if (mod(rowIndex, 2.0) == 1.0) {
    uv.x += cellSize.x * 0.5;
}
```

## Audio Reactivity

Animated in `useFrame` inside `Effects.jsx`, following the same smoothing pattern as existing effects:

```js
// Smooth audio values
s.htBass += (audioBass - s.htBass) * Math.min(delta * 8, 1)
s.htAvg  += (audioAvg  - s.htAvg)  * Math.min(delta * 6, 1)

if (halftoneRef.current) {
    // Bass → dot radius pulse (dots swell on beat)
    const baseRadius = 0.35
    halftoneRef.current.uniforms.get('uRadius').value =
        baseRadius + s.htBass * 0.15

    // Average energy → grid density (louder = tighter grid)
    const baseGrid = 48.0
    halftoneRef.current.uniforms.get('uGridSize').value =
        baseGrid + s.htAvg * 20.0
}
```

### What Responds to What

| Audio Band | Visual Response |
|-----------|----------------|
| **Bass** | Dot radius swells — beat-synced pulsing |
| **Average** | Grid density increases — louder = more dots |
| **High** | (optional) Softness flicker — crispy transients |

## Scroll Integration

The halftone effect should **evolve** as the user scrolls through sections:

| Scroll Range | Behavior |
|-------------|----------|
| **0.0–0.3** (Awaken) | No halftone — clean scene, let the glass shape shine |
| **0.3–0.5** (Resonate) | Halftone fades in, large dots, dot mode. Sparse and atmospheric |
| **0.5–0.7** (Harmonize) | Grid tightens, transition to ring mode. More detail visible |
| **0.7–1.0** (Transcend) | Dot+square hybrid, dense grid, full audio reactivity. Pairs with bloom crescendo |

```js
const scroll = scrollState.offset

// Halftone intensity (0 = invisible, 1 = full)
const htIntensity = scroll < 0.3 ? 0 :
    scroll < 0.4 ? (scroll - 0.3) / 0.1 : 1.0

// Mode transitions
const htMode = scroll < 0.5 ? 0 :   // dot
    scroll < 0.7 ? 1 :               // ring
    2                                  // dot+square

halftoneRef.current.uniforms.get('uMode').value = htMode
// Use intensity to lerp uRadius toward 0 (dots disappear when intensity = 0)
```

## GPU Tiering

Follow existing pattern — only enable on `gpuTier >= 2`:

```jsx
{gpuTier >= 2 && halftoneEnabled && (
    <HalftonePass ref={halftoneRef} gridSize={48} radius={0.35} stagger />
)}
```

On tier 1 (low-end GPUs), skip entirely. The scene already looks good without it.

## Optional: User Toggle

Add a minimal UI control (keyboard shortcut or overlay button) to toggle halftone on/off:

- **Key:** `H` to toggle
- **State:** stored in a shared mutable ref (like audioState/scrollState pattern)
- **Default:** ON (if GPU tier allows)

## Performance Notes

- The shader is a single full-screen pass — cheap on modern GPUs
- `floor()` pixelation means we sample the input texture once per cell, not per pixel
- `smoothstep` is a single instruction on all GPUs
- Grid size of 48 = ~2,000 dots on a 1080p screen — trivial fill rate
- Stagger adds one `mod` + conditional per fragment — negligible

## Visual Reference

The target aesthetic: [Maxime Heckel's halftone article](https://blog.maximeheckel.com/posts/shades-of-halftone/) — specifically the colored halftone over 3D scenes with luma-driven dot sizing and staggered grids.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/shaders/HalftoneEffect.js` | **CREATE** — Effect class + fragment shader |
| `src/components/Effects.jsx` | **MODIFY** — add halftone to composer chain + useFrame animation |
| `src/components/Experience.jsx` | **MODIFY** — (optional) add H key toggle listener |

## Out of Scope (Future)

- CMYK multi-layer halftone (Moiré management is complex)
- Animated dot patterns (rotating/shifting grids)
- Per-object halftone (would need custom material, not post-processing)
- Halftone on specific scroll sections only (masking)
