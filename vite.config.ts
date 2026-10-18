import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // 전시장에서는 서버 루트가 아닌 곳에 얹힐 수 있다. 상대 경로로 굽는다.
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // 태블릿이 같은 공유기에서 들어올 수 있어야 한다
    host: true,
    open: true,
  },
})
