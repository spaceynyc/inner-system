# Verification record

Date: 2026-09-06. Windows, Chrome, Node 22.21.1 / npm 11.8.0.

## Automated

- Fresh `npm ci`: 203 packages installed, audit reported zero vulnerabilities.
- `npm run lint`: passed with zero warnings.
- `npm test`: 21 tests in four files passed.
- `npm run build`: TypeScript and Vite production build passed.
- `git diff --check`: no whitespace errors.

Tests exercise versioned composition validation and portable links; real frequency-band calculations; lazy audio initialization, graph reuse, play/pause races, file replacement/cleanup, rejected playback, and level decay; PostgreSQL persistence, idempotency, token hashing, owner revocation, expiry, cleanup and shared rate limits; and HTTP create/open/social metadata/revoke, content type, body limits and origin validation.

Database tests run real embedded PostgreSQL (PGlite), not a mocked SQL implementation. The HTTP suite runs a loopback HTTP server against an isolated in-memory database.

## Chrome interaction checks

Both the development build and built frontend (`npm run preview`, port 4173) were opened in Chrome.

| Flow | Observed result |
| --- | --- |
| Initial visit | Text and controls load; audio does not autoplay; glass appears when assets are ready |
| Playback | Play/pause labels follow media state; track time advances; seeking to 30 seconds updates the player |
| Local audio | File picker loaded the repository MP3 as a local file and started playback; return to original reset the title and paused |
| Geometry and palettes | All three Blender models render; shape and palette choices update selected state and artwork |
| Presets | Event horizon loads octahedron, eclipse, 40% response, 96% clarity, 15% dispersion and no orbit |
| Save/reopen | Indigo orbit saved to the device and survived a page reload with matching geometry and palette |
| Reset/undo | Reset restored Midnight drift; undo restored the previous name, form and palette |
| Sharing | Unlisted link opened in another tab; owner revocation made a subsequent load show unavailable |
| Fallback | An unavailable local storage service produced a complete portable settings link rather than disabling sharing |
| PNG export | Browser image preview loaded real artwork at exactly 1600 x 1600 pixels |
| Keyboard | M changes form; I opens instrument; Escape closes the native dialog and restores the trigger; immersive layout exposes its exit control |
| Comfort | Reduced motion and Light quality update their selected state |
| Responsive | 390 x 844 portrait and 768 x 1024 tablet inspected, alongside 1440 x 900 desktop |
| Production console | No application or shader errors in the fresh production tab; upstream Three.Clock deprecation warning remains |

The mobile instrument reserves space above its bottom sheet for the live sculpture. The tablet renderer and CSS use the same breakpoint, including when a scrollbar reduces canvas width.

## Limits and release requirements

- Cloud PostgreSQL and production signing/cron secrets were not provisioned during this implementation. Portable links work without those services. Persistent short links require the deployment setup documented in README.
- PNG generation and its visible preview were verified. Chrome automation did not report a download event after clicking the download link, so OS-level file-save completion is not claimed.
- These are Chrome checks on one Windows machine with viewport emulation, not physical iOS/Safari/Android testing or a formal accessibility certification.
- No Lighthouse, Core Web Vitals, or device-wide frame-rate claim is made. The Three.js chunk remains about 725 KB minified / 185 KB gzip and triggers Vite's normal size advisory. The graphics path is deferred; this does not eliminate its download or GPU cost.
- WebGL context recovery has a retry UI and listener cleanup, but a forced device/context-loss experiment was not performed.
- The original bundled MP3's rights were not independently verified. Models and brand artwork were created for this overhaul; DM Sans carries its bundled OFL license.

### Hero divider follow-up

The desktop hero now lays out its content and bottom divider in separate grid rows, with a minimum 32 px gap. It grows when the headline needs extra vertical space. Browser measurements confirm clearance at 4042 x 1046, 1440 x 900, and 1280 x 720; the unchanged 390 x 844 mobile layout retains about 12 px clearance. Production build passes.


### Observatory interaction upgrade

- Added a dedicated cinematic room with steerable glass facets, sustained unfolding, an illuminated knot core, responsive particles, and bounded expanding echo rings. It preserves the black/midnight/indigo art direction.
- A deterministic eight-second recorder captures pointer direction, held state, and release events. It automatically loops, can be interrupted by a fresh gesture, and clears on reset or room exit. Timing uses a separate visible-page clock with bounded substeps instead of depending on GPU frame rate.
- Optional sine tones use the existing user-started audio graph and volume. Voices are capped at eight, rate limited, disconnected when finished, and stopped on pause/disposal. No new dependency, API contract, or cloud service is required.
- Browser verification on the production build: native pointer drag/release, arrow-key steering, tap-based open/release, automatic replay, live interruption, sound on/off, reset clearing the take, reduced-motion control, and Escape restoring focus to the entry button.
- Visually inspected 1440 x 900 desktop, 390 x 844 mobile, and 360 x 740 small mobile. The fully opened form stays between the heading and console. At 360 px the document width equals the viewport and all console controls fit vertically.
- Exported a fully expanded composition: the browser loaded the actual 1600 x 1600 PNG preview. Export framing now measures the visible sculpture meshes. The prior OS-save verification limitation still applies.
- 27 automated tests pass, including slow-frame take timing, replay across repeated loops, cancellation, waveform limits, and audio voice cleanup. ESLint and the TypeScript/production build pass. No browser console errors were observed during the Observatory playthrough.
- Motion takes are session-only: they are not saved in the collection or included in shared composition links. Reduced motion removes particle movement and echo rings, reduces unfolding distance, and retains explicit directional controls.
