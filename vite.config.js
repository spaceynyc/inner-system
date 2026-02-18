import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glsl'],
  server: {
    host: true,
    allowedHosts: ['spaceynycs-mac-mini-1.tailbf3a3b.ts.net']
  }
})
