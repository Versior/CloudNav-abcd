# cloudnav-dav

给 CloudNav / NaviX「云端备份」用的 **Cloudflare 原生 WebDAV 服务端**（Worker + KV）。

## 为什么需要它

`dav.jianguoyun.com` 的解析链是
`dav.jianguoyun.com → app.jianguoyun.com → cloudflarelb.jianguoyun.com`：
坚果云用 Cloudflare LB 承接境外流量，源站在国内。Cloudflare 边缘（LHR / SJC
均已复现）对坚果云的 **所有方法**（PROPFIND / GET / OPTIONS，含 80 端口与主站
`www.jianguoyun.com`）一律返回 `520 error code: 520`；同一环境下
`baidu.com` / `163.com` / `taobao.com` 均正常 200。

因此任何从 Pages Functions / Workers 发起的 WebDAV 请求都会拿到 520，
**改 User-Agent、编码等请求头无法绕过**，这是服务商侧的出口 IP 限制。
替代方案只有三条：

1. 换用 Cloudflare 可达的 WebDAV（该 Worker 即此方案，数据存在你自己的 CF 账号里）；
2. 为该网盘配一台国内中转（例如国内 VPS 上跑一个反代，网址填中转地址）；
3. 换其他境外可达的 WebDAV 服务商。

## 部署

```bash
npx wrangler kv namespace create CLOUDNAV_DAV   # 把返回的 id 填进 wrangler.toml
npx wrangler deploy
printf '%s' '<强密码>' | npx wrangler secret put DAV_PASS
```

然后在应用「备份与恢复」里把 WebDAV 地址填成部署好的域名，
用户名用 `DAV_USER`（默认 `cloudnav`），密码用上面设置的 `DAV_PASS`。

## 实现要点

- 方法：`OPTIONS` / `PROPFIND`(Depth 0|1) / `GET` / `HEAD` / `PUT` / `DELETE` / `MKCOL`
- 鉴权：HTTP Basic（`DAV_USER` / `DAV_PASS`，未配置密码时拒绝一切请求）
- 单文件上限 8 MiB
- KV 的 `list()` 是最终一致的，刚 PUT 完立刻 PROPFIND 可能看不到新文件，
  因此额外维护一个索引键，让「查看历史备份」立即可见（`list()` 结果做并集兜底）
