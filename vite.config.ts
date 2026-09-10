import path from 'path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { onRequestGet, onRequestOptions } from './functions/api/rss.ts';
import { onRequestGet as onWeatherRequestGet, onRequestOptions as onWeatherRequestOptions } from './functions/api/weather.ts';
import { onRequestGet as onGithubRequestGet, onRequestOptions as onGithubRequestOptions } from './functions/api/github.ts';
import { onRequestGet as onContentRequestGet, onRequestOptions as onContentRequestOptions } from './functions/api/content.ts';
import { onRequestGet as onAuthRequestGet, onRequestPost as onAuthRequestPost, onRequestOptions as onAuthRequestOptions } from './functions/api/auth.ts';
import { onRequestGet as onStorageRequestGet, onRequestPost as onStorageRequestPost, onRequestOptions as onStorageRequestOptions } from './functions/api/storage.ts';
import { onRequestPost as onAiRequestPost, onRequestOptions as onAiRequestOptions } from './functions/api/ai.ts';
import { onRequestPost as onWebdavRequestPost, onRequestOptions as onWebdavRequestOptions } from './functions/api/webdav.ts';
import { onRequestGet as onFetchTitleRequestGet, onRequestOptions as onFetchTitleRequestOptions } from './functions/api/fetchtitle.ts';
import { onRequestPost as onLinkRequestPost, onRequestOptions as onLinkRequestOptions } from './functions/api/link.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const requestHeaders = (request: IncomingMessage) => {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
    else if (value) headers.set(name, value);
  });
  return headers;
};

// Cloudflare Functions 之外的本地开发也要返回 JSON，避免 Vite SPA fallback 把 /api/* 变成 index.html。
// 这里使用进程内 KV，只用于本地开发；生产环境仍由 Cloudflare KV 接管。
const localKvStore = new Map<string, { value: string; expiresAt?: number }>();
const localKv = {
  async get(key: string) {
    const entry = localKvStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      localKvStore.delete(key);
      return null;
    }
    return entry.value;
  },
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    localKvStore.set(key, {
      value,
      expiresAt: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
    });
  },
  async delete(key: string) {
    localKvStore.delete(key);
  },
};

const localEnv = {
  CLOUDNAV_KV: localKv,
  PASSWORD: process.env.CLOUDNAV_PASSWORD || '',
  SESSION_SECRET: process.env.CLOUDNAV_SESSION_SECRET || 'cloudnav-local-development-secret',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

type LocalHandler = (context?: any) => Promise<Response> | Response;
const localApiRoutes: Record<string, { get?: LocalHandler; post?: LocalHandler; options: LocalHandler }> = {
  '/api/auth': { get: (context) => onAuthRequestGet({ ...context, env: localEnv }), post: (context) => onAuthRequestPost({ ...context, env: localEnv }), options: onAuthRequestOptions },
  '/api/storage': { get: (context) => onStorageRequestGet({ ...context, env: localEnv }), post: (context) => onStorageRequestPost({ ...context, env: localEnv }), options: onStorageRequestOptions },
  '/api/ai': { post: (context) => onAiRequestPost({ ...context, env: localEnv }), options: onAiRequestOptions },
  '/api/webdav': { post: (context) => onWebdavRequestPost({ ...context, env: localEnv }), options: onWebdavRequestOptions },
  '/api/fetchtitle': { get: (context) => onFetchTitleRequestGet({ ...context, env: localEnv }), options: onFetchTitleRequestOptions },
  '/api/link': { post: (context) => onLinkRequestPost({ ...context, env: localEnv }), options: onLinkRequestOptions },
  '/api/rss': { get: onRequestGet, options: onRequestOptions },
  '/api/weather': { get: onWeatherRequestGet, options: onWeatherRequestOptions },
  '/api/github': { get: onGithubRequestGet, options: onGithubRequestOptions },
  '/api/content': { get: onContentRequestGet, options: onContentRequestOptions },
};

const localRssApi = (): Plugin => ({
  name: 'local-rss-api',
  configureServer(server) {
    server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
      const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const route = localApiRoutes[requestUrl.pathname];
      if (!route) {
        next();
        return;
      }

      try {
        const webRequest = new Request(requestUrl, {
          method: request.method || 'GET',
          headers: requestHeaders(request),
        });
        const method = (request.method || 'GET').toUpperCase();
        const handler = method === 'OPTIONS' ? route.options : method === 'GET' ? route.get : method === 'POST' ? route.post : undefined;
        if (!handler) {
          response.statusCode = 405;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        const webResponse = await handler({ request: webRequest });

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
