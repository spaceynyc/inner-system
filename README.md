# THE INNER SYSTEM

A small universe made of sound and light. Four editorial chapters lead into an interactive instrument with three Blender-authored glass forms, real audio analysis, and a black / midnight / indigo palette.

## Run

Use Node **22.21.1** and npm **11.8.0** (`.nvmrc` and the lockfile pin the baseline).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The local API automatically initializes embedded PostgreSQL in `.data/postgres`; no external account is needed. Leave `.env` absent for this mode. Stop the dev server before starting a second process against that embedded database.

```sh
npm run lint
npm test
npm run build
npm run preview
```

Preview serves the production frontend and the same local API at http://127.0.0.1:4173. It is a local verification server, not a public backend host.

## Experience

- Native scrolling through Arrival, Resonance, Refraction, and Release, with HTML typography and real chapter links.
- Three beveled glass forms authored in Blender: icosahedron, dodecahedron, octahedron. Facets separate through the journey and respond to the signal.
- Bass changes mass; mids change motion; highs change reflected light. No audio or AudioContext exists before interaction.
- The Observatory turns the sculpture into a gesture instrument: drag to steer, hold to unfold its facets, release to send expanding light rings. A particle field follows the attraction.
- Record an eight-second gesture and replay its movement and echoes in a loop. Takes live only in memory and clear when the room closes. Tap controls and arrow keys provide alternatives to dragging.
- Optional pentatonic gesture tones join the existing audio graph only after playback starts, share its volume, and stop when audio pauses.
- The instrument changes geometry, atmosphere, response, clarity, dispersion, and orbit. Undo stores up to 30 changes. Save keeps up to 20 compositions on the device.
- The player supports play/pause, seeking, volume, mute, and local audio up to 50 MB. Local audio is decoded by the browser and never sent to the API.
- Unlisted links use PostgreSQL when configured. Portable links encode validated settings in the URL and work without a service. Neither includes local audio.
- Centered 1600 x 1600 PNG artwork export with an inspectable preview and download link.
- Keyboard controls: Space play/pause, M change form, I instrument, ? help, Escape close/exit. Native dialogs contain focus and restore it on close.
- Reduced motion, reduced intensity, and automatic/high/light visual quality. The renderer stops in hidden tabs and settles to idle in reduced-motion mode when audio is paused.

## Architecture

```text
src/App.tsx                  Semantic page, chapter navigation, shared-link loading
src/styles.css               Layout, typography, responsive controls
src/contracts/composition.ts Versioned Zod contract and portable-link codec
src/state/                   Zustand studio state and render capture interface
src/engine/audio/            Lazy Web Audio graph and smoothed frequency analysis
src/engine/performance/      Bounded gesture recorder and deterministic replay
src/engine/scene/            Deferred R3F scene, glass optics, lighting, PNG capture
src/features/                Audio, instrument/collection, and Observatory UI
server/                      PostgreSQL adapter, repository, HTTP service, migration
api/service.ts               Vercel function entry point
public/models/               Runtime GLB assets
art/                         Editable Blender source
scripts/build-sculptures.py   Reproducible model generation
```

React 19, TypeScript 5.9, Vite 8, Three.js 0.185, Fiber 9, Drei 10, Zustand 5, Zod 4, PostgreSQL. DOM settings update React; render-frequency data stays outside React subscriptions. Graphics and post effects load in separate chunks. Three's core remains a substantial download; the build reports its size rather than hiding the warning.

## Production sharing on Vercel

The frontend remains usable with portable links if no database is configured. For short links, configure a PostgreSQL database and these **server-only** environment variables for the intended deployment environment:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL using the provider's TLS settings |
| `SHARE_SIGNING_KEY` | Random secret of at least 32 characters, stable across deployments |
| `CRON_SECRET` | Random secret for authenticated daily cleanup |
| `APP_ORIGIN` | Canonical public origin, e.g. `https://inner-system-two.vercel.app` |

Use separate databases/signing keys for preview and production. Never prefix secrets with `VITE_`. `.env.example` is documentation; copying it without real values does not configure a working service. The scripts read `.env` when present.

Run `npm run db:migrate` with the target database environment before enabling persistent sharing. Migrations are idempotent initialization SQL in `server/schema.ts`; future destructive changes need an explicit versioned migration and backup. Vercel's Node major follows `package.json`; patch-level runtime selection is controlled by Vercel.

`vercel.json` maps `/api/*` and `/s/:id` to the serverless entry point, sets response headers and model caching, and schedules daily authenticated cleanup. Ordinary static hosting supports the portable-link fallback but must not be described as hosting the PostgreSQL API.

### API

| Method and route | Behavior |
| --- | --- |
| `GET /api/health` | Liveness and configuration flag; not a database connectivity probe |
| `GET /api/presets` | Versioned curated compositions |
| `POST /api/compositions` | JSON contract, `Idempotency-Key` required; returns ID, ownership token, expiry |
| `GET /api/compositions/:id` | Active composition or 404 |
| `DELETE /api/compositions/:id` | Revoke using `Authorization: Bearer <ownership-token>` |
| `GET /s/:id` | Social metadata and redirect into the composition |
| `GET /api/cleanup` | Cleanup with the configured cron bearer secret |

Bodies are limited to 8 KB, settings are strictly validated, and writes use a shared 12/minute identity bucket. IDs are random and unlisted; they are not private access control. Links expire after 90 days. The database stores a hash of the revoke token, not the token itself. Owner controls survive reload in the same browser session and appear in Collection. Closing/clearing that session loses ownership controls. Portable links cannot be revoked.

The service stores composition settings and metadata, never audio. Operational logs omit audio, file names, request bodies, raw network identities, and secrets. Plan provider-level quotas and abuse controls before marketing a public anonymous sharing service at scale.

## Models and assets

Blender 4.5 was used for the source scene and exports. With Blender on PATH, run `npm run models`; otherwise invoke your Blender executable with `--background --python scripts/build-sculptures.py` from this directory. The script rebuilds the three GLBs and `art/inner-system-sculptures.blend`.

The models and brand mark were created for this overhaul. DM Sans is self-hosted from Fontsource under its bundled OFL license. The MP3 is carried over unchanged from the original repository; its licensing/provenance has not been independently established. Confirm those rights before broader distribution.

See `docs/QA.md` for the actual verification record and remaining limits.
