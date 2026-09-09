import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { onRequestGet, onRequestOptions } from './functions/api/rss';

const requestHeaders = (request: IncomingMessage) => {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
    else if (value) headers.set(name, value);
  });
  return headers;
};

const localRssApi = (): Plugin => ({
  name: 'local-rss-api',
  configureServer(server) {
    server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
      const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (requestUrl.pathname !== '/api/rss') {
        next();
        return;
      }

      try {
        const webRequest = new Request(requestUrl, {
          method: request.method || 'GET',
          headers: requestHeaders(request),
        });
        const webResponse = request.method === 'OPTIONS'
          ? await onRequestOptions()
          : await onRequestGet({ request: webRequest });

        response.statusCode = webResponse.status;
        webResponse.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(Buffer.from(await webResponse.arrayBuffer()));
      } catch (error) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local RSS API failed' }));
      }
    });
  },
});

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), localRssApi()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          pinyin: ['pinyin-pro'],
          backup: ['jszip', 'qrcode'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
