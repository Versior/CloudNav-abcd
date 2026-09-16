/**
 * cloudnav-dav — 最小可用的 WebDAV 服务端（Cloudflare Worker + R2）
 *
 * 用途：给 CloudNav / NaviX 的「云端备份」提供一个 Cloudflare 边缘可达的 WebDAV 目标。
 * 背景：坚果云（dav.jianguoyun.com）走 cloudflarelb 回源国内，Cloudflare 边缘回源被拒，
 *       任何从 Workers/Pages Functions 发起的请求都会得到 520，无法从代码层修复。
 *
 * 为什么用 R2 而不是 KV：KV 的读有 ≥30 秒的边缘缓存（cacheTtl 下限 30），
 * list() 也是最终一致的——「刚上传就恢复」可能读回旧内容。R2 读写强一致，
 * 且 list() 立即反映写入。
 *
 * 支持方法：OPTIONS / PROPFIND(Depth 0|1) / GET / HEAD / PUT / DELETE / MKCOL
 * 鉴权：HTTP Basic（DAV_USER / DAV_PASS），未配置密码时拒绝所有请求。
 */

// 与 CloudNav 备份请求体上限保持一致（一份备份实测约 2.3 MB）
const MAX_PUT_BYTES = 16 * 1024 * 1024;
const LIST_LIMIT = 1000;

const normalizePath = (raw) => {
  let path = raw || "/";
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/\/{2,}/g, "/");
  return path;
};

/** WebDAV 路径 -> R2 对象键（目录以 "/" 结尾，对象键不带前导斜杠）。 */
const objectKey = (path) => (path === "/" ? "" : path.replace(/^\//, ""));

/** 列出某个集合时的 R2 前缀。 */
const listPrefix = (path) => (path === "/" ? "" : path.replace(/^\//, ""));

const xmlEscape = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const httpDate = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
};

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

const fileProps = (size, modified) =>
  propstat(
    `<D:resourcetype/>` +
      `<D:getcontentlength>${size}</D:getcontentlength>` +
      `<D:getlastmodified>${httpDate(modified)}</D:getlastmodified>` +
      `<D:getcontenttype>application/json</D:getcontenttype>`,
    "200 OK"
  );

async function handlePropfind(request, env, path) {
  const depth = (request.headers.get("Depth") || "1").trim();
  const isCollection = path.endsWith("/");
  const responses = [];

  if (isCollection) {
    responses.push(`<D:response><D:href>${xmlEscape(path)}</D:href>${collectionProps()}</D:response>`);

    if (depth !== "0") {
      const prefix = listPrefix(path);
      const listed = await env.DAV_BUCKET.list({ prefix, limit: LIST_LIMIT });
      const seenDirs = new Set();

      for (const object of listed.objects) {
        const rest = object.key.slice(prefix.length);
        if (!rest) continue;

        const slash = rest.indexOf("/");
        if (slash >= 0) {
          const dirName = rest.slice(0, slash + 1);
          if (seenDirs.has(dirName)) continue;
          seenDirs.add(dirName);
          responses.push(`<D:response><D:href>${xmlEscape(path + dirName)}</D:href>${collectionProps()}</D:response>`);
          continue;
        }

        responses.push(
          `<D:response><D:href>${xmlEscape(path + rest)}</D:href>${fileProps(object.size, object.uploaded)}</D:response>`
        );
      }
    }
  } else {
    const object = await env.DAV_BUCKET.head(objectKey(path));
    if (!object) return new Response("Not Found", { status: 404 });
    responses.push(
      `<D:response><D:href>${xmlEscape(path)}</D:href>${fileProps(object.size, object.uploaded)}</D:response>`
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
          if (path.endsWith("/")) return new Response("Method Not Allowed", { status: 405 });
          const object = await env.DAV_BUCKET.get(objectKey(path));
          if (!object) return new Response("Not Found", { status: 404 });
          const headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": String(object.size),
            "Last-Modified": httpDate(object.uploaded),
            ETag: object.httpEtag || `"${object.size}-${object.uploaded?.getTime?.() || 0}"`,
          };
          return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
        }

        case "PUT": {
          const declared = Number(request.headers.get("Content-Length") || 0);
          if (declared > MAX_PUT_BYTES) return new Response("Payload Too Large", { status: 413 });
          const body = await request.arrayBuffer();
          if (body.byteLength > MAX_PUT_BYTES) return new Response("Payload Too Large", { status: 413 });

          const existed = await env.DAV_BUCKET.head(objectKey(path));
          await env.DAV_BUCKET.put(objectKey(path), body, {
            httpMetadata: { contentType: "application/json; charset=utf-8" },
            customMetadata: { mtime: String(Date.now()) },
          });
          return new Response(null, { status: existed ? 204 : 201 });
        }

        case "DELETE": {
          const existed = await env.DAV_BUCKET.head(objectKey(path));
          if (!existed) return new Response("Not Found", { status: 404 });
          await env.DAV_BUCKET.delete(objectKey(path));
          return new Response(null, { status: 204 });
        }

        case "MKCOL":
          return new Response(null, { status: 201 });

        default:
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL" },
          });
      }
    } catch (error) {
      return new Response(`WebDAV error: ${error?.message || error}`, { status: 500 });
    }
  },
};