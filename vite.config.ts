import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    define: {
      'import.meta.env.VITE_APP_URL': JSON.stringify(
        process.env.APP_URL || 'https://ais-pre-iilcebmw4madl2gy2lpdl6-259473150381.asia-east1.run.app'
      ),
    },
    plugins: [react(), tailwindcss()],
    publicDir: path.resolve(__dirname, 'public'),
    resolve: {
      alias: {
        '@/src': path.resolve(__dirname, './src'),
        '@': path.resolve(__dirname, './src'),
        '~': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
            }
          },
        },
      },
    },
  };
});
