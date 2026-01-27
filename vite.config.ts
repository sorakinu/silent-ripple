import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pagesのベースパスを設定
  base: '/silent-ripple/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
