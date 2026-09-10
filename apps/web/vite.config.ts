import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  base: isProduction ? '/' : '/civic-relay/',
  plugins: [
    react(),
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // ENS Alto Compliance - Security Headers
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'DENY');
          res.setHeader('X-XSS-Protection', '1; mode=block');
          res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:3001"
          );
          res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
          res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
          next();
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
    sourcemap: !isProduction,
    minify: isProduction ? 'terser' : false,
    terserOptions: isProduction ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    } : undefined,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'map-vendor': ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false,
  },
  preview: {
    port: 3000,
    strictPort: false,
  },
});
