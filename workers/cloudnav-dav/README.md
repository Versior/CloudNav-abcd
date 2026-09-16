# cloudnav-dav

给 CloudNav / NaviX「云端备份」用的 **Cloudflare 原生 WebDAV 服务端**（Worker + R2）。

## 为什么需要它

`dav.jianguoyun.com` 的解析链是
`dav.jianguoyun.com → app.jianguoyun.com → cloudflarelb.jianguoyun.com`：
坚果云用 Cloudflare LB 承接境外流量、源站在国内。Cloudflare 边缘（LHR / SJC
均已复现）对坚果云的 **所有方法**（PROPFIND / GET / OPTIONS，含 80 端口与主站
`www.jianguoyun.com`）一律返回 `520 error code: 520`；同一环境下
`baidu.com` / `163.com` / `taobao.com` 均正常 200。

因此任何从 Pages Functions / Workers 发起的 WebDAV 请求都会拿到 520，
**改 User-Agent、编码等请求头无法绕过**，这是服务商侧的出口 IP 限制。
替代方案只有三条：

1. 换用 Cloudflare 可达的 WebDAV（该 Worker 即此方案，数据存在你自己的 CF 账号里）；
2. 为该网盘配一台国内中转（例如国内 VPS 上跑一个反代，地址填中转地址）；
3. 换其他境外可达的 WebDAV 服务商。

## 为什么用 R2 而不是 KV

KV 的读带有 ≥30 秒的边缘缓存（`cacheTtl` 下限就是 30，传 0 会被拒绝），
`list()` 也是最终一致的。实测表现为「刚上传备份、立刻恢复」会读回**上一次**的内容，
对备份语义不可接受。R2 读写强一致、`list()` 立即反映写入，因此这里用 R2，
也就不需要额外维护列表索引键。

## 部署

```bash
npx wrangler r2 bucket create cloudnav-dav     # 名字与 wrangler.toml 保持一致
npx wrangler deploy
printf '%s' '<强密码>' | npx wrangler secret put DAV_PASS
```

然后在应用「备份与恢复」里把 WebDAV 地址填成部署好的域名，
用户名用 `DAV_USER`（默认 `cloudnav`），密码用上面设置的 `DAV_PASS`。

## 实现要点

- 方法：`OPTIONS` / `PROPFIND`(Depth 0|1) / `GET` / `HEAD` / `PUT` / `DELETE` / `MKCOL`
- 鉴权：HTTP Basic（`DAV_USER` / `DAV_PASS`，未配置密码时拒绝一切请求）
- 单文件上限 8 MiB，`PROPFIND` 单次最多列 1000 个对象
- 存储键：WebDAV 路径去掉前导斜杠（如 `/cloudnav_backup.json` → `cloudnav_backup.json`）