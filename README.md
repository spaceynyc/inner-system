# THE INNER SYSTEM

An immersive, audio-reactive 3D web experience built with React Three Fiber.

Live site: https://inner-system-two.vercel.app/

## What This Project Is

THE INNER SYSTEM is a cinematic, scroll-driven single-page experience where sound, geometry, lighting, and post-processing respond in real time.

The core visual is a transmissive "glass" polyhedron that:
- morphs between geometric states on click,
- reacts to live frequency bands from an audio analyser,
- shifts position and scale with page scroll,
- and is rendered with dynamic lighting and bloom effects.

## Experience Highlights

- Audio-reactive deformation driven by bass, mids, highs, and average frequency energy.
- Morph transitions between icosahedron, dodecahedron, and octahedron targets.
- Four scroll sections with camera interpolation and atmospheric color transitions.
- Floating particles and typography layered into the 3D scene.
- HTML overlay content synchronized with R3F scroll state.
- Custom preloader with staged loading progress and smooth scene reveal.

## Interaction Model

- `Play/Pause`: Starts or pauses the audio loop and all audio-reactive behavior.
- `Scroll`: Moves through 4 sections (`intro`, `explore`, `discover`, `transcend`).
- `Click Glass Shape`: Cycles to the next geometry state.
- `Drag Orbit`: Presentation controls allow subtle scene interaction.

## Tech Stack

- React + Vite
- Three.js + @react-three/fiber
- @react-three/drei
- @react-three/postprocessing
- Framer Motion
- Maath

## Project Structure

```text
src/
  App.jsx
  index.css
  audioState.js
  scrollState.js
  components/
    Experience.jsx
    GlassShape.jsx
    DreamBackground.jsx
    FloatingParticles.jsx
    FloatingText.jsx
    ScrollContent.jsx
    Overlay.jsx
    Effects.jsx
    Preloader.jsx
    LoadingManager.jsx
    AssetTracker.jsx
```

## Local Development

```bash
npm install
npm run dev
```

Default dev URL: `http://localhost:5173`

## Build And Preview

```bash
npm run build
npm run preview
```

## Audio Asset Note

The scene expects an audio file at:

`public/assets/track.mp3`

If this file is missing, the experience still renders, but audio-reactive effects will stay minimal.

## Performance Notes

- Geometry detail is intentionally constrained for stable frame time.
- Vertex normals on the glass mesh are recalculated on a reduced interval instead of every frame.
- Canvas DPR is capped for balance between fidelity and performance.

## Deployment

This repository is configured as a standard Vite app and deploys cleanly to platforms like Vercel.

Current production deployment:
https://inner-system-two.vercel.app/
