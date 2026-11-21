import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // библиотека SVG (~1,4 МБ текста) встраивается в бандл целиком
  build: { chunkSizeWarningLimit: 2000 },
})
