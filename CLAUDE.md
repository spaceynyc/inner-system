# Working on The Inner System

Read README.md for the current architecture, commands, API contract, and deployment setup.

- Use TypeScript. Current entry points are `src/main.tsx`, `src/App.tsx`, and `vite.config.ts`.
- Keep the palette black, midnight, and indigo. Use HTML for text and controls; Three.js renders the artwork.
- Maintain a user-gesture boundary for audio. Local audio must stay on the device.
- Do not put per-frame frequency or pointer data into React state.
- The v1 composition schema is shared by client and server. Validate changes at both boundaries and preserve older saved compositions deliberately.
- Never expose server secrets as `VITE_` variables. Local embedded PostgreSQL is for development, not serverless persistence.
- Run `npm run lint`, `npm test`, and `npm run build` after functional changes. Browser-check the actual production build: play/pause, navigation, studio changes, save/reopen, sharing/revocation, and PNG export. Compilation alone is insufficient.
- Check desktop and portrait layouts and native dialog keyboard behavior. Honor reduced motion and background-tab suspension.
- Blender source and the regeneration script belong with the GLB exports.
