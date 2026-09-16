# 「同步冲突」弹窗频繁出现的根因分析与修复

> 现象：弹窗「同步冲突 — 本地和云端数据都发生了修改。三方合并会保留双方独立修改，并按更新时间处理同字段冲突。」

## 一、结论（先说答案）

**有一个开着的浏览器端，每 30 分钟把你 2.27 MB 的全量数据重写一次云端，只为了保存一个天气读数。**
每次写入都会把云端 `version` +1 并生成一个历史快照，于是任何在这中间保存数据的端都会拿到
`409 Conflict`，前端收到 409 就弹「同步冲突」。

也就是说：**这不是网络问题，也不是坚果云/WebDAV 的问题，而是客户端后台任务触发了全量版本化同步。**

## 二、证据链

### 1. 云端历史快照的间隔是精确的 30 分钟

从 KV 里 30 个 `app_history:v*` 快照的时间戳看（UTC）：

```
v238  08:21:46
v239  08:51:45   (+30.0 分)
v240  09:21:45   (+30.0 分)
...
v251  14:51:49   (+30.0 分)
v252  15:21:49   (+30.0 分)
v253  15:51:46   (+30.0 分)   ← 这一版把 app_data 推到 version 254
```

### 2. 这 30 分钟里 `links` 一个字节都没变，变的只有天气

对相邻快照做哈希比对（v249 → v252）：

| 字段 | 是否变化 |
| :--- | :--- |
| `links`（616 个书签） | **从未变化** |
| `rssState` / `inspirations` / `readLater` / `githubWatch` / `readingDocuments` | 从未变化 |
| `workspace.workbenchTools` | **每 30 分钟都变** |

`workbenchTools.weather` 的实际内容：

```
v249 (13:51Z)  {"temperature":24.7,"windSpeed":22.6,"updatedAt":1789564901841,...}
v250 (14:21Z)  {"temperature":24.8,"windSpeed":23.4,"updatedAt":1789566701817,...}
v251 (14:51Z)  {"temperature":24.8,"windSpeed":23.8,"updatedAt":1789568502017,...}
v252 (15:21Z)  {"temperature":24.8,"windSpeed":23.7,"updatedAt":1789570303619,...}
```

### 3. 客户端里唯一的 30 分钟定时器就是天气组件

线上 bundle 中只有一处 `setInterval`：

```js
yx = 1800 * 1e3;                      // 30 分钟
const _ = async () => { ... fetch("/api/weather?auto=1") ...
  w.current(cu({ ...A.current, weather: ut.weather }))   // 更新工作台配置
};
z.useEffect(() => { _(); const k = setInterval(_, yx); return () => clearInterval(k) }, [_]);
```

而工作台/仪表盘配置的更新处理函数是：

```js
on = f => {
  const y = cu(f); Ln(y); _t(uu, y);
  W && navigator.onLine && _a(B, q);      // ← 这里触发了 links/categories 的全量云同步
};
```

`_a(B, q)` 是 220ms 防抖后的 `Qe(links, categories, baseVersion, workspace)`，
也就是 `POST /api/storage`。所以：**天气刷新 → 触发一次完整的版本化同步。**

### 4. 前端只要收到 409 就弹窗

从线上 bundle 还原出的同步逻辑（节选）：

```js
G = await fetch("/api/storage", { method:"POST", body: JSON.stringify({ links, categories, workspace, baseVersion }) });
if (G.status === 409) {
  const tt = (await G.json())?.data;
  if (tt && Array.isArray(tt.links)) {
    we.current = tt.version ?? we.current;
    const Ne = $x(we.current, { links, categories }, { links: tt.links, categories: tt.categories || [] }); // 三方合并
    if (Za.current === Ne) { oe("error"); return false; }
    Za.current = Ne; za.current = true;
    const ie = uv(Sl.current, { links, categories }, { links: tt.links, categories: tt.categories || [] });
    He({ links: ie.linkConflicts, categories: ie.categoryConflicts });
    Se(true);                        // ← 打开「同步冲突」弹窗
  }
}
```

## 三、修复方案

### A. 根治（需要重新发布前端）

**A1. 后台/挂件状态不要走版本化全量同步**（推荐，改一处）

工作台与仪表盘配置本质是「本机外观/挂件状态」，不应该触发 links/categories 的全量同步：

```js
// 现在
on = f => { const y = cu(f); Ln(y); _t(uu, y); W && navigator.onLine && _a(B, q) };
// 改为：只存配置，不触发全量同步
on = f => {
  const y = cu(f); Ln(y); _t(uu, y);
  if (W && navigator.onLine) {
    fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saveConfig: "workbench", config: y }) }).catch(() => {});
  }
};
```

或在同步 payload 里把 `workspace.workbenchTools.weather` 这类易变字段剔除，
让它走一个非版本化的配置接口。

**A2. 没有真实字段冲突时静默合并，不弹窗**（防御性，2 行）

三方合并已经算出冲突集合 `ie.linkConflicts / ie.categoryConflicts`。
若两者都为空，说明只是「两边各自改了自己的部分」，可以直接采用合并结果，不必打断用户：

```js
const ie = uv(Sl.current, { links, categories }, { links: tt.links, categories: tt.categories || [] });
const noRealConflict = (ie.linkConflicts?.length ?? 0) === 0 && (ie.categoryConflicts?.length ?? 0) === 0;
if (noRealConflict) { Ot(ie.data.links, ie.data.categories); return true; }   // 静默合并
He({ links: ie.linkConflicts, categories: ie.categoryConflicts });
Se(true);                                                                    // 真有冲突才弹窗
```

**A3. 顺手检查上传超时**：同步请求有 12 秒 abort，而每份 payload 约 2.3 MB
（`workspace.readingDocuments` 就有 537 KB）。弱网/移动网络下上传超时也会落到
`error` 分支并按待同步处理，放大冲突概率。可考虑只上传增量，或提高超时。

### B. 立刻缓解（不需要发布）

1. **关掉不需要的标签页/设备**：每个开着的端每 30 分钟写一次云端，多端必然互相撞。
2. **暂时停用天气挂件**：它是那个 30 分钟写入源；在工作台里移除天气即可让定时器不再启动。
3. 如需临时阻断写入源，可在 Zone 上加一条 Worker route
   `nav.006680.xyz/api/weather` 返回 503——前端 `!yt.ok` 会走 catch，不再更新天气、
   也就不再触发同步（代价是天气显示「天气服务暂时不可用」）。可随时删除该 route。

## 四、相关但独立的一个隐患

`cloudnav-abcd-health-cron`（cron `0 */6 * * *`）在服务端**直接改写 `app_data` 并 `version + 1`**：

```js
await env.CLOUDNAV_KV.put('app_data', JSON.stringify({ ...latest, links: latestLinks, version: latest.version + 1 }));
```

它不参与 baseVersion 协商，所以**一旦开启「自动健康检测」并真的跑起来，
每次运行都会让所有端在下一次保存时冲突**。目前 KV 里没有
`health_schedule_config` / `health_run_history`，说明它还没成功运行过
（默认配置下会 `skipped: not_due`）。如果要用自动健康检测，建议同样按 A2 的思路
在服务端写入后不递增 `version`，或让客户端容忍「仅 health 字段变化」的版本漂移。

## 五、历史快照被后台写入挤占

`app_history` 上限 30 份，而每 30 分钟就消耗 1 份 → 历史实际上只覆盖约 15 小时，
且几乎全是「只有天气不同」的版本。修好 A1 之后，30 份才会重新代表真实的编辑历史。