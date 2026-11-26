import devServer from '@hono/vite-dev-server';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// One Node process: Vite serves the web page at / and hands /api to the Hono app in server/app.ts.
export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: 'server/app.ts',
      exclude: [/^(?!\/api(?:[/?#]|$))/],
      injectClientScript: false,
    }),
  ],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    host: 'localhost',
  },
});
