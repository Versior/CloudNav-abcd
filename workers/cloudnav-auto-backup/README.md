# cloudnav-auto-backup

CloudNav 的**每日自动备份**：直接读 KV 里的 `app_data`，PUT 到 WebDAV 后端（R2）。

## 为什么不用 Cron Trigger

Cloudflare **免费版账号上限是 5 个 cron 触发器**（报错：
`This account has reached the Workers Free limit of 5 cron triggers per account`），
这个账号已经用满：`cloudnav-abcd-health-cron`、`cleanup-worker`、
`cf-server-monitor`（2 个）、`cloudflare_temp_email`。
因此改用 **Durable Object 的 alarm 自续期**：alarm 执行完再排下一次，
不占用 cron 配额，也不依赖浏览器是否打开页面。

## 行为

- 读 KV：`app_data`（数据本体）、`webdav_config`（地址/账号）、`auto_backup_config`（开关）
- **数据未变化时跳过**（对 `app_data` 取 SHA-256 与上次比对），避免无意义覆盖与额外操作量
  · 计算指纹前会剔除易变字段 `workspace.workbenchTools.weather`——客户端天气挂件
    每 30 分钟就会改写它并触发一次全量云同步，否则"未变化"永远不成立
    （可用 `ignoreWeather: false` 关闭该行为）
- PUT 文件名默认 `cloudnav_backup.json`（覆盖式 → 云端始终只有最新一份）
- 上传后按 `keep` 清理旧备份（默认只留最新 1 份）
- 结果写入 KV `auto_backup_state`
- 顺带做**数据历史裁剪**：`app_history:v*` 只保留最新 `historyKeep` 份，
  并同步清理 `app_history_index` 里的对应条目（历史快照一份约 2.3 MB，
  30 份就是 ~64 MB，是 KV 最大的占用来源）

## 配置（KV `auto_backup_config`）

```json
{ "enabled": true, "hourUtc": 20, "keep": 1, "historyKeep": 5, "filename": "cloudnav_backup.json" }
```

- `hourUtc`：每天执行的 UTC 小时，默认 20 = 北京时间 04:00
- `keep`：云端保留份数，默认 1（只留最新一份），0 = 不清理
- `historyKeep`：KV 数据历史保留份数，默认 5；0 = 不裁剪。
  注意它与 `enabled` 无关（属于 KV 占用的日常维护）
- `filename`：支持 `{date}` / `{ts}` 占位符；不填则覆盖同一个文件

## 部署

```bash
npx wrangler deploy
printf '%s' '<强随机串>' | npx wrangler secret put RUN_TOKEN
```

## 手动触发 / 查看状态

```bash
curl "https://<你的域名>/run?token=<RUN_TOKEN>&force=1"   # 立即备份一次
curl "https://<你的域名>/status?token=<RUN_TOKEN>"        # 下次执行时间 + 上次结果
```
