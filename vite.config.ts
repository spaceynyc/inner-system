import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { service } from './server/service.ts'

function localApi(): Plugin {
  const middleware = (req: Parameters<typeof service>[0], res: Parameters<typeof service>[1], next: () => void) => {
    if (req.url?.startsWith('/api/') || req.url?.startsWith('/s/')) void service(req, res, true)
    else next()
  }
  return { name: 'inner-system-local-api', configureServer(server) { server.middlewares.use(middleware) }, configurePreviewServer(server) { server.middlewares.use(middleware) } }
}
export default defineConfig({
  plugins: [react(), localApi()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'three', test: /node_modules[\\/]three[\\/]/ },
      { name: 'post-effects', test: /node_modules[\\/]postprocessing[\\/]/ },
    ] } } },
  },
})
