// 把修复后的 functions/api/webdav.ts 包成 Worker，用于挂在线上
// nav.006680.xyz/api/webdav 这条 route 上，避免重新发布 Pages 造成 UI 回退。
import { onRequestPost, onRequestOptions } from '../../functions/api/webdav';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return onRequestOptions();

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return onRequestPost({ request, env });
  },
};