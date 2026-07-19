import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Default matches a project Pages path; CI overrides via VITE_BASE_PATH.
  base: process.env.VITE_BASE_PATH || '/internship-apps-dashb/',
})
