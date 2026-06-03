import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_TIMESTAMP__: Date.now(),
  },
  plugins: [react()],
})
