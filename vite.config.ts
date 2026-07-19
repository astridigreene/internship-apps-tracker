import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Set to '/<repo-name>/' for project Pages sites, or '/' for user/org sites.
  base: process.env.VITE_BASE_PATH || '/internship-apps-dashboard/',
})
