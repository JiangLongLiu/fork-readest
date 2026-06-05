## Readest 自建服务器存储配额分析

**结论**：自建服务器的存储配额由 `docker/.env` 中的 `STORAGE_FIXED_QUOTA` 环境变量控制。这个环境变量一旦设置，就会覆盖所有其他配额逻辑，所有用户无论什么 plan 都统一使用该固定值。

> **变更记录**：2026-06-05，将 `STORAGE_FIXED_QUOTA` 从 `1073741824`（1GB）修改为 `21474836480`（20GB），同步更新了 `.env.tauri` 中的 `NEXT_PUBLIC_STORAGE_FIXED_QUOTA`，并重启了 Docker 服务。

---

### 一、配额计算的完整逻辑链

配额的计算入口是 `getStoragePlanData()` 函数，位于以下文件：

```
C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\utils\access.ts
```

核心代码（第 50-66 行）：

```typescript
export const getStoragePlanData = (token: string) => {
  const data = jwtDecode<Token>(token) || {};
  const plan = data['plan'] || 'free';
  const usage = data['storage_usage_bytes'] || 0;
  const purchasedQuota = data['storage_purchased_bytes'] || 0;
  const runtimeConfig = getRuntimeConfig();
  const fixedQuota =
    runtimeConfig?.storageFixedQuota ?? parseInt(process.env['STORAGE_FIXED_QUOTA'] ?? '0');
  const planQuota = fixedQuota || DEFAULT_STORAGE_QUOTA[plan] || DEFAULT_STORAGE_QUOTA['free'];
  const quota = planQuota + purchasedQuota;

  return { plan, usage, quota };
};
```

#### 决策流程图

```
JWT Token 解码
    │
    ├── plan = token.plan || 'free'
    ├── usage = token.storage_usage_bytes || 0
    └── purchasedQuota = token.storage_purchased_bytes || 0

判断 fixedQuota：
    │
    ├── runtimeConfig.storageFixedQuota（浏览器端 window.__READEST_RUNTIME_CONFIG）
    │   或
    └── process.env['STORAGE_FIXED_QUOTA']（服务端）
        │
        ▼
    fixedQuota 有值且非零？
        │
    YES ─→ planQuota = fixedQuota          ← 【自建部署走这条路】
    NO  ─→ planQuota = DEFAULT_STORAGE_QUOTA[plan]
                                    │
                                    ├── free:     500 MB
                                    ├── plus:     5 GB
                                    ├── pro:      20 GB
                                    └── purchase: 0（无限）

最终：quota = planQuota + purchasedQuota
```

---

### 二、为什么自建部署使用固定配额

**当前配置**：`docker/.env` 中设置了：

```env
STORAGE_FIXED_QUOTA=21474836480
```

`21474836480` 字节 = `20 × 1024 × 1024 × 1024` = 20 GB（2026-06-05 从 1GB 调整为 20GB）。

**传递路径**：

```
docker/.env
  STORAGE_FIXED_QUOTA=21474836480  (20GB)
      │
      ▼
docker/compose.yaml → client 服务的环境变量
  STORAGE_FIXED_QUOTA: ${STORAGE_FIXED_QUOTA:-1073741824}
      │
      ▼
服务端 API（如 /api/storage/upload）
  parseInt(process.env['STORAGE_FIXED_QUOTA'])  →  21474836480
      │
      ▼
getStoragePlanData() 中
  fixedQuota = 21474836480   (非零，走 YES 分支)
  planQuota = 21474836480    (覆盖所有 plan 等级)
  quota = 21474836480 + 0    (自建无 purchasedQuota)
      │
      ▼
所有用户配额 = 20 GB
```

同时，客户端的 `.env.tauri` 中也设置了相同的值：

```env
NEXT_PUBLIC_STORAGE_FIXED_QUOTA=1073741824
```

这个值在编译时被嵌入到 Android/Windows 客户端的 JavaScript 中，客户端 UI 据此显示"1 GB 云存储空间"。

---

### 三、`STORAGE_FIXED_QUOTA` 的设计意图

这个环境变量的存在是**有意为之**的。Readest 官方服务有一套完整的付费计划系统（free / plus / pro / purchase），不同 plan 对应不同的存储配额。但自建部署场景下：

1. **没有 Stripe 支付系统** — 用户无法订阅付费计划
2. **JWT token 中没有 `plan` 声明** — GoTrue 默认给所有用户 `plan = 'free'`
3. **没有 `payments` 表** — `storage_purchased_bytes` 始终为 0

如果不设置 `STORAGE_FIXED_QUOTA`，所有自建用户只能得到 free plan 的默认配额 **500 MB**（见下方默认配额表）。设置 `STORAGE_FIXED_QUOTA` 是为了让自建管理员可以**统一设定一个比 free plan 更高的配额**，覆盖所有用户。

---

### 四、默认配额表（`STORAGE_FIXED_QUOTA` 未设置时）

当 `STORAGE_FIXED_QUOTA` 未设置或为 0 时，配额回退到按 plan 分级。默认值定义在：

```
C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\services\constants.ts
第 812-817 行
```

```typescript
export const DEFAULT_STORAGE_QUOTA: UserStorageQuota = {
  free:     500 * 1024 * 1024,       // 500 MB
  plus:     5   * 1024 * 1024 * 1024, //   5 GB
  pro:     20   * 1024 * 1024 * 1024, //  20 GB
  purchase: 0,                         // 无限
};
```

| Plan | 存储配额 | 翻译配额（每日） |
|------|----------|-----------------|
| free | 500 MB | 10 KB |
| plus | 5 GB | 100 KB |
| pro | 20 GB | 500 KB |
| purchase | 无限 | — |

**自建部署中**，因为 JWT 中没有 plan 信息，所有用户默认是 `free`。如果不设 `STORAGE_FIXED_QUOTA`，就只有 500 MB。

---

### 五、配额在哪些地方被检查

| 检查点 | 文件 | 逻辑 |
|--------|------|------|
| **文件上传** | `src/pages/api/storage/upload.ts` 第 52-54 行 | `if (usage + fileSize > quota + 10MB grace)` → 拒绝上传 |
| **分享导入** | `src/app/api/share/[token]/import/route.ts` 第 118-119 行 | `if (usage + share.bookSize > quota + 10MB grace)` → 拒绝导入 |
| **用量统计** | `src/pages/api/storage/stats.ts` 第 66-67 行 | 计算 `usagePercentage` 展示给用户 |
| **客户端 UI** | `src/hooks/useQuotaStats.ts` 第 16-26 行 | 在设置页面显示存储用量进度条 |

上传检查有一个 **10 MB 的宽限**（`STORAGE_QUOTA_GRACE_BYTES = 10 * 1024 * 1024`），即实际允许上传到 `quota + 10MB` 才拒绝。

---

### 六、usage（已用量）从哪来

`usage` 来自 JWT token 中的 `storage_usage_bytes` 声明：

```typescript
const usage = data['storage_usage_bytes'] || 0;
```

这个值由 GoTrue 在签发 JWT 时从 `auth.users.raw_app_meta_data` 中读取并嵌入 token。在自建部署中，这个字段**从未被更新过**（因为没有上传/删除的 webhook 来同步），所以：

- `usage` 始终为 `0`
- 这意味着即使 `quota` 是 1GB，**配额检查实际上永远不会触发拒绝**（因为 `0 + fileSize > 1GB + 10MB` 几乎不会成立，除非单个文件超过 1GB）

换句话说，自建部署中 1GB 的配额限制在**上传检查层面形同虚设**，但客户端 UI 可能仍然会显示"已用 0 B / 1 GB"。

不过 `/api/storage/stats` 接口通过直接查询 `files` 表计算真实的磁盘用量（`totalSize`），这个是准确的。

---

### 七、如何调整配额

要修改自建部署的存储配额，只需修改一个文件：

**文件**：`C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\.env`

```env
# 当前配置为 20GB，可改为其他值
STORAGE_FIXED_QUOTA=21474836480
```

常用值参考：

| 配额 | 字节值 |
|------|--------|
| 1 GB | `1073741824` |
| 5 GB | `5368709120` |
| 10 GB | `10737418240` |
| 50 GB | `53687091200` |
| 100 GB | `107374182400` |
| 不限制 | `0`（会回退到 free plan 的 500 MB，不推荐） |

修改后重启服务：

```bash
cd docker
docker compose down
docker compose up -d
```

如果 Android/Windows 客户端也需要显示正确的配额数字，还需要同步修改 `apps/readest-app/.env.tauri` 中的 `NEXT_PUBLIC_STORAGE_FIXED_QUOTA` 并重新编译客户端。

---

### 八、相关文件索引

| 文件 | 绝对路径 | 与本分析的关联 |
|------|----------|---------------|
| **.env** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\.env` | `STORAGE_FIXED_QUOTA` 的定义处 |
| **compose.yaml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\compose.yaml` | 将 `STORAGE_FIXED_QUOTA` 传入 client 容器 |
| **access.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\utils\access.ts` | `getStoragePlanData()` — 配额计算核心逻辑 |
| **constants.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\services\constants.ts` | `DEFAULT_STORAGE_QUOTA` — 各 plan 的默认配额 |
| **runtimeConfig.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\services\runtimeConfig.ts` | 运行时配置的读取方式 |
| **upload.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\storage\upload.ts` | 上传时的配额检查 |
| **stats.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\storage\stats.ts` | 存储用量统计 API |
| **useQuotaStats.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\hooks\useQuotaStats.ts` | 客户端 UI 配额显示 |
| **.env.tauri** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\.env.tauri` | 客户端编译时的 `NEXT_PUBLIC_STORAGE_FIXED_QUOTA` |
