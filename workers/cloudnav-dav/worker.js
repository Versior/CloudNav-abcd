/**
 * cloudnav-dav — 最小可用的 WebDAV 服务端（Cloudflare Worker + KV）
 *
 * 用途：给 CloudNav / NaviX 的「云端备份」提供一个 Cloudflare 边缘可达的 WebDAV 目标。
 * 背景：坚果云（dav.jianguoyun.com）走 cloudflarelb 回源国内，Cloudflare 边缘回源被拒，
 *       任何从 Workers/Pages Functions 发起的请求都会得到 520，无法从代码层修复。
 *
 * 支持方法：OPTIONS / PROPFIND(Depth 0|1) / GET / HEAD / PUT / DELETE / MKCOL
 * 鉴权：HTTP Basic（DAV_USER / DAV_PASS），未配置密码时拒绝所有请求。
 */

// KV 的 list() 是最终一致的：刚 PUT 完立刻 PROPFIND 可能看不到新文件。
// 因此额外维护一个索引键，让「查看历史备份」立即可见（list() 结果做并集兜底）。
const INDEX_KEY = "dav:__index__";

async function readIndex(env) {
  try {
    const raw = await env.DAV_KV.get(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function writeIndex(env, paths) {
  await env.DAV_KV.put(INDEX_KEY, JSON.stringify(paths.slice(0, 500)));
}

const PREFIX = "dav:";
const MAX_PUT_BYTES = 8 * 1024 * 1024;

const normalizePath = (raw) => {
  let path = raw || "/";
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/\/{2,}/g, "/");
  return path;
};

const kvKey = (path) => PREFIX + normalizePath(path);

const xmlEscape = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const httpDate = (ms) => new Date(ms || Date.now()).toUTCString();

const unauthorized = () =>
  new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="cloudnav-dav", charset="UTF-8"' },
  });

const timingSafeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const isAuthorized = (request, env) => {
  if (!env.DAV_PASS) return false;
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try { decoded = atob(header.slice(6).trim()); } catch { return false; }
  const index = decoded.indexOf(":");
  if (index < 0) return false;
  const user = decoded.slice(0, index);
  const pass = decoded.slice(index + 1);
  const expectedUser = env.DAV_USER || "cloudnav";
  return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, env.DAV_PASS);
};

const propstat = (inner, status) =>
  `<D:propstat><D:prop>${inner}</D:prop><D:status>HTTP/1.1 ${status}</D:status></D:propstat>`;

const collectionProps = () => propstat("<D:resourcetype><D:collection/></D:resourcetype>", "200 OK");

const fileProps = (size, mtime) =>
  propstat(
    `<D:resourcetype/>` +
      `<D:getcontentlength>${size}</D:getcontentlength>` +
      `<D:getlastmodified>${httpDate(mtime)}</D:getlastmodified>` +
      `<D:getcontenttype>application/json</D:getcontenttype>`,
    "200 OK"
  );

async function handlePropfind(request, env, path) {
  const depth = (request.headers.get("Depth") || "1").trim();
  const isDir = path.endsWith("/");
  const responses = [];

  if (isDir) {
    responses.push(`<D:response><D:href>${xmlEscape(path)}</D:href>${collectionProps()}</D:response>`);

    if (depth !== "0") {
      const listed = await env.DAV_KV.list({ prefix: kvKey(path) });
      const candidates = new Set();
      for (const entry of listed.keys) {
        const rest = entry.name.slice(kvKey(path).length);
        if (rest) candidates.add(path + rest);
      }
      for (const indexed of await readIndex(env)) {
        if (indexed.startsWith(path) && indexed.length > path.length) candidates.add(indexed);
      }

      const seenDirs = new Set();
      for (const href of [...candidates].sort()) {
        const rest = href.slice(path.length);
        const slash = rest.indexOf("/");
        if (slash >= 0) {
          const dirName = rest.slice(0, slash + 1);
          if (seenDirs.has(dirName)) continue;
          seenDirs.add(dirName);
          responses.push(`<D:response><D:href>${xmlEscape(path + dirName)}</D:href>${collectionProps()}</D:response>`);
          continue;
        }
        const meta = await env.DAV_KV.getWithMetadata(kvKey(href), { type: "arrayBuffer" });
        if (!meta.value) continue;
        responses.push(
          `<D:response><D:href>${xmlEscape(href)}</D:href>${fileProps(
            meta.value.byteLength,
            meta.metadata?.mtime
          )}</D:response>`
        );
      }
    }
  } else {
    const found = await env.DAV_KV.getWithMetadata(kvKey(path), { type: "arrayBuffer" });
    if (!found.value) return new Response("Not Found", { status: 404 });
    responses.push(
      `<D:response><D:href>${xmlEscape(path)}</D:href>${fileProps(
        found.value.byteLength,
        found.metadata?.mtime
      )}</D:response>`
    );
  }

  const body =
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<D:multistatus xmlns:D="DAV:">${responses.join("")}</D:multistatus>`;

  return new Response(body, {
    status: 207,
    headers: { "Content-Type": 'application/xml; charset="utf-8"', DAV: "1, 2" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          DAV: "1, 2",
          Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL",
          "Content-Length": "0",
        },
      });
    }

    if (!isAuthorized(request, env)) return unauthorized();

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      switch (request.method) {
        case "PROPFIND":
          return await handlePropfind(request, env, path);

        case "GET":
        case "HEAD": {
          const found = await env.DAV_KV.getWithMetadata(kvKey(path), { type: "arrayBuffer" });
          if (!found.value) return new Response("Not Found", { status: 404 });
          const headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": String(found.value.byteLength),
            "Last-Modified": httpDate(found.metadata?.mtime),
            ETag: `"${found.value.byteLength}-${found.metadata?.mtime || 0}"`,
          };
          return new Response(request.method === "HEAD" ? null : found.value, { status: 200, headers });
        }

        case "PUT": {
          const declared = Number(request.headers.get("Content-Length") || 0);
          if (declared > MAX_PUT_BYTES) return new Response("Payload Too Large", { status: 413 });
          const body = await request.arrayBuffer();
          if (body.byteLength > MAX_PUT_BYTES) return new Response("Payload Too Large", { status: 413 });
          const existed = await env.DAV_KV.get(kvKey(path), { type: "arrayBuffer" });
          await env.DAV_KV.put(kvKey(path), body, { metadata: { mtime: Date.now() } });

          const index = await readIndex(env);
          if (!index.includes(path)) await writeIndex(env, [path, ...index]);

          return new Response(null, { status: existed ? 204 : 201 });
        }

        case "DELETE": {
          const existed = await env.DAV_KV.get(kvKey(path), { type: "arrayBuffer" });
          if (!existed) return new Response("Not Found", { status: 404 });
          await env.DAV_KV.delete(kvKey(path));

          const index = await readIndex(env);
          if (index.includes(path)) await writeIndex(env, index.filter((entry) => entry !== path));

          return new Response(null, { status: 204 });
        }

        case "MKCOL":
          return new Response(null, { status: 201 });

        default:
          return new Response("Method Not Allowed", { status: 405, headers: { Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL" } });
      }
    } catch (error) {
      return new Response(`WebDAV error: ${error?.message || error}`, { status: 500 });
    }
  },
};