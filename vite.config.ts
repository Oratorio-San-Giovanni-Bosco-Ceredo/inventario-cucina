import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Il base path deve corrispondere al nome della repo per GitHub Pages:
// https://oratorio-san-giovanni-bosco-ceredo.github.io/inventario-cucina/
export default defineConfig({
  base: '/inventario-cucina/',
  plugins: [react(), tailwindcss()],
})
