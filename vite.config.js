import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    host: true,
    open: false // Set to true if you want browser to open automatically
  },
  build: {
    // Enable code splitting for faster initial load
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'api-vendor': [
            './src/services/movieApiService.js',
            './src/services/recommendationService.js'
          ]
        }
      }
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Minify JavaScript for production (esbuild is built-in and fast)
    minify: 'esbuild',
    // Remove console.logs in production for smaller bundle
    esbuild: {
      drop: ['console', 'debugger']
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})



