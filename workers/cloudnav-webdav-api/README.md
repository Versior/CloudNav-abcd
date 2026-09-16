# cloudnav-webdav-api

把修好的 `functions/api/webdav.ts` **以 Worker 形式挂到线上站点的 `/api/webdav` 路由**上。

## 为什么需要它

线上 Pages 项目跑的是比你本地更新的一版源码（`ad_hoc` 直传，commit 不在 GitHub 上），
直接用仓库里的 main / codex 分支重新发布 Pages 会把线上更新的 UI 回退掉。
这个 Worker 用 Cloudflare 的 route 只接管 `/api/webdav` 一个路径，前端零改动、
秒级可回滚，因此可以在不动 Pages 的前提下让后端修复生效。

## 构建与部署

```bash
npx esbuild entry.ts --bundle --format=esm --platform=neutral --outfile=worker.js

# 把 wrangler.toml 里的 routes / KV id 换成你自己的
npx wrangler deploy
# PASSWORD 必须与 Pages 生产环境的 PASSWORD 相同，否则已有会话 cookie 会失效
printf '%s' '<与 Pages 相同的 PASSWORD>' | npx wrangler secret put PASSWORD
```

## 回滚

删除 route 即恢复由 Pages Functions 处理 `/api/webdav`：

```bash
npx wrangler deployments list        # 或直接在控制台删掉这条 route
```

控制台：**Workers & Pages → 你的 Worker → Settings → Triggers → Routes**。

## 注意

- 一旦你把自己的本地源码（已合并 `fix/webdav-520`）重新发布到 Pages，
  这条 route 就不再需要，删掉它即可。
- 该 Worker 与 Pages 共用同一个 `CLOUDNAV_KV`（读 `webdav_config`），
  所以它在哪台 Worker 上运行都会读到同一份 WebDAV 配置。