import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const apiPort = process.env.VITE_API_PORT ?? "3001"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/health": `http://localhost:${apiPort}`,
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
})
