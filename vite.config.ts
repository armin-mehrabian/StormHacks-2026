import { defineConfig } from 'vite'

// Keep the default in sync with server/index.ts.
const apiPort = process.env.PORT ?? '3001'

export default defineConfig({
  server: {
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
})
