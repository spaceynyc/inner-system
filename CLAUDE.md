# CLAUDE.md

## Project Overview

THE INNER SYSTEM - A high-end interactive 3D landing page built with React Three Fiber featuring a frosted glass centerpiece, floating particles, and audio-reactive animations.

## Tech Stack

- **Framework:** React 18.2 + Vite 5.0
- **3D Graphics:** React Three Fiber 8.15 + Three.js 0.160 + Drei 9.96
- **Animation:** Framer Motion 10.18, Maath (math utilities)
- **Styling:** CSS with glass morphism patterns

## Commands

```bash
npm run dev      # Start dev server with HMR
npm run build    # Production build
npm run lint     # ESLint (strict mode, 0 warnings allowed)
npm run preview  # Preview production build
```

## Project Structure

```
src/
├── components/
│   ├── DreamBackground.jsx   # Scene background, fog, colors
│   ├── Experience.jsx        # Main 3D scene orchestrator
│   ├── FloatingParticles.jsx # Sparkle particle systems
│   ├── FloatingText.jsx      # 3D text rendering
│   ├── GlassShape.jsx        # Interactive icosahedron with transmission material
│   └── Overlay.jsx           # Play/pause UI overlay
├── App.jsx                   # Root component with Canvas setup
├── main.jsx                  # Entry point
└── index.css                 # Global styles
public/assets/                # Static assets (audio, images)
```

## Architecture Notes

- **State Management:** Simple React hooks (useState), no Redux/Context
- **Animation Loop:** useFrame hook for per-frame 3D updates
- **Audio:** PositionalAudio from Drei, controlled via playState prop
- **Interactivity:** PresentationControls for mouse/touch orbit, hover effects on GlassShape

## Code Conventions

- Functional components with hooks
- JSX files for React components
- CSS class selectors with descriptive names
- Three.js refs for direct mesh manipulation
- Maath easing for smooth interpolations

## Key Materials & Effects

- MeshTransmissionMaterial for frosted glass (chromatic aberration, anisotropy)
- Sparkles component for particle effects
- Fog for depth perception
- Backdrop filters for UI glass morphism
