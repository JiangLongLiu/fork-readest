# Readest 自建服务器部署总览

本目录包含 Readest 自建服务器的完整部署方案，包括 Docker 服务端部署和 Android/Windows 客户端编译。本 README 将所有配置文件和详细文档串联起来，方便快速查阅和在新机器上复现。

---

## 整体架构

```
客户端（Android / Windows / Web）
        │
        │  http://<HOST_IP>:8000  (统一入口：认证 + REST + API 代理)
        │  http://<HOST_IP>:3000  (前端页面，也可直接访问)
        │  http://<HOST_IP>:9002  (文件上传下载)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│                Docker Compose 服务栈                     │
│                                                         │
│  kong (:8000) ──→ auth        (认证 /auth/*)            │
│      │                                                  │
│      ├──→ rest ──→ db         (REST /rest/*)            │
│      │                                                  │
│      └──→ client (:3000)      (API  /api/* 代理)        │
│              │                                          │
│              └──→ minio (:9000) ←── nginx-s3 (:9002)    │
└─────────────────────────────────────────────────────────┘
```

Kong 网关 (:8000) 是所有客户端流量的**统一入口**，同时代理认证 (`/auth/*`)、REST (`/rest/*`) 和 API (`/api/*`) 三类路由。客户端只需知道一个地址即可完成全部操作。

7 个长期运行的容器：client、kong、auth、rest、db、minio、nginx-s3-proxy。详见 [Docker 服务端部署指南](Readest-Docker服务端部署指南.md)。

---

## 近期更新（2026-06-05）

### Kong 统一入口（架构简化）

此前客户端需要同时知道两个地址——Kong `:8000`（认证）和 Next.js `:3000`（API 调用），配置复杂且容易出错。现在 Kong 新增了 `api-proxy` 服务，将 `/api/*` 请求代理到 `http://client:3000`，**客户端只需配置 Kong 网关一个地址即可完成全部操作**。

**变更内容：**
- `kong.yml` 新增 `api-proxy` service + route，匹配 `/api/*` 路径，upstream 指向 `http://client:3000`
- 客户端 `.env.tauri` 中 `NEXT_PUBLIC_API_BASE_URL` 从 `:3000` 改为 `:8000`
- Kong 网关现在是认证 (`/auth/*`)、REST (`/rest/*`)、API (`/api/*`) 的统一入口

### 客户端修复

以下修复已包含在当前版本中，解决了 Tauri 桌面端和 Android 端在自建服务器场景下的多个关键问题：

| 修复项 | 涉及文件 | 说明 |
|--------|----------|------|
| **动态 API 端点解析** | `sync.ts`、`storage.ts` | API URL 不再在模块加载时冻结，改为运行时动态获取，避免 Supabase 重初始化后仍使用旧 URL |
| **AuthContext 重新订阅** | `AuthContext` 相关组件 | Supabase 客户端重新初始化后，AuthContext 正确重新订阅认证状态变更事件 |
| **getAccessToken localStorage 回退** | 认证工具函数 | 当 Supabase session API 不可用时（Tauri 常见），自动回退到 localStorage 获取 access token |
| **fetchWithAuth 401 自动重试** | HTTP 请求层 | 收到 401 响应时自动刷新 token 并重试请求，提升自建服务器场景下的稳定性 |

---

## 快速开始

### 1. 启动服务端

```bash
cd docker
cp .env.example .env
# 编辑 .env，填写 HOST_IP、密码、JWT 密钥（详见部署指南第三节）
docker compose up -d
```

启动后访问：

- Kong 统一入口：`http://<HOST_IP>:8000`（认证 / REST / API 代理）
- Web 客户端：`http://<HOST_IP>:3000`（或直接通过 Kong :8000 访问）
- MinIO 控制台：`http://<HOST_IP>:9001`

### 2. 编译客户端（可选）

如果需要 Android APK 或 Windows 桌面端，需要编译客户端并嵌入服务器地址。**客户端只需配置 Kong 网关地址 (`:8000`)，所有请求均通过 Kong 统一路由：**

```bash
# 编辑 apps/readest-app/.env.tauri，填写服务器地址
# 然后执行编译（详见 Android 编译指南）
cd apps/readest-app
npx tauri android build -t aarch64
```

---

## 核心配置文件速查

以下按部署流程中的修改顺序列出。标注 **[必须修改]** 的在新机器部署时一定要改。

### 服务端配置

| 文件 | 绝对路径 | 何时需要修改 |
|------|----------|-------------|
| **.env** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\.env` | **[必须修改]** 每次新机器部署都要改 HOST_IP、密码、JWT 密钥 |
| **compose.yaml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\compose.yaml` | 一般不改，除非要调整端口映射或添加服务 |
| **nginx-s3-proxy.conf** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\nginx-s3-proxy.conf` | 一般不改，CORS 和代理规则已调通 |
| **kong.yml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\volumes\api\kong.yml` | 一般不改，已含 auth、rest、api-proxy 三条路由规则（新增 `/api/*` 代理到 client:3000） |
| **schema.sql** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\volumes\db\init\schema.sql` | 不改，数据库表结构定义 |

### 客户端编译配置

| 文件 | 绝对路径 | 何时需要修改 |
|------|----------|-------------|
| **.env.tauri** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\.env.tauri` | **[必须修改]** 编译客户端前填写 Kong 网关地址（`:8000`，认证和 API 均走同一入口） |
| **build.gradle.kts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src-tauri\gen\android\app\build.gradle.kts` | 确认 `usesCleartextTraffic = "true"`（HTTP 服务器必须） |
| **keystore.properties** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src-tauri\gen\android\keystore.properties` | 需手动创建，填写 APK 签名信息 |

### 服务端 API 源码（排查问题时参考）

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| **sync.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\sync.ts` | 书籍同步 API（已改为动态端点解析，不再在模块加载时冻结 URL） |
| **upload.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\storage\upload.ts` | 文件上传 presigned URL（已改为动态端点解析） |
| **download.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\storage\download.ts` | 文件下载 presigned URL（已改为动态端点解析） |
| **s3.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\utils\s3.ts` | S3 双端点签名逻辑 |

---

## 两个关键 .env 文件的关系

服务端和客户端各有一个 `.env`，它们之间通过 URL 关联。**客户端的所有地址均指向 Kong 网关 (:8000)，实现统一入口：**

```
docker/.env（服务端）                    apps/readest-app/.env.tauri（客户端）
─────────────────                        ─────────────────────────────────
HOST_IP=100.108.143.105      ──────→    NEXT_PUBLIC_SUPABASE_URL=http://100.108.143.105:8000
ANON_KEY=eyJ...              ──────→    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
KONG_HTTP_PORT=8000          ──────→    (端口部分)
SERVICE_ROLE_KEY=eyJ...      ──────→    SUPABASE_ADMIN_KEY=eyJ...
                                         NEXT_PUBLIC_API_BASE_URL=http://100.108.143.105:8000
MINIO_ROOT_PASSWORD=xxx      ──────→    S3_SECRET_ACCESS_KEY=xxx
S3_BUCKET_NAME=readest-files ──────→    S3_BUCKET_NAME=readest-files
```

> **注意**：`NEXT_PUBLIC_API_BASE_URL` 现已改为指向 Kong (`:8000`) 而非直连 client (`:3000`)。Kong 的 `api-proxy` 服务会将 `/api/*` 请求代理到 `http://client:3000`，这样客户端只需配置一个地址即可完成认证、REST 查询和 API 调用（同步、存储）全部操作。

客户端的 `.env.tauri` 中的地址在编译时被嵌入 JavaScript，之后无法修改。服务端 `.env` 的修改只需重启 Docker 即可生效（Web 端）或需重编译客户端（Android/Windows）。

> **客户端运行时动态解析**：从当前版本起，`sync.ts` 和 `storage.ts` 中的 API 端点不再在模块加载时冻结 URL，而是在每次调用时动态解析，确保 Supabase 客户端重新初始化后能正确使用最新配置。

---

## 详细文档

| 文档 | 内容 |
|------|------|
| [Docker 服务端部署指南](Readest-Docker服务端部署指南.md) | 服务架构、S3 双端点设计、.env 配置详解、Kong 路由、数据库 Schema、API 端点、6 个踩坑记录、运维命令 |
| [Android APK 编译指南](Readest-Android-APK编译指南.md) | Tauri 构建管线、前端嵌入原理、usesCleartextTraffic、Windows symlink 绕过、Rust 缓存清理、问题诊断方法论、完整构建脚本 |

---

## 新机器部署清单

在新机器上从零部署，按顺序执行：

**服务端：**
1. 克隆项目代码，初始化 git 子模块
2. 复制 `docker/.env.example` → `docker/.env`，修改 HOST_IP、密码、JWT 密钥
3. `cd docker && docker compose up -d`
4. 验证 Kong 统一入口：`curl http://<HOST_IP>:8000/auth/v1/health`

**客户端（如需 Android/Windows）：**
5. 安装 Rust、Android SDK/NDK、JDK 17+、Node.js + pnpm
6. 编辑 `apps/readest-app/.env.tauri`，填入 Kong 网关地址（`NEXT_PUBLIC_API_BASE_URL` 指向 `:8000`）
7. 确认 `build.gradle.kts` 中 `usesCleartextTraffic = "true"`
8. 编译 Android：`npx tauri android build -t aarch64`
9. Windows 上手动复制 `.so` + Gradle 打包（详见编译指南第四节）

**验证：**
10. 验证 Kong 网关：`curl http://<HOST_IP>:8000/auth/v1/health`（认证）和 `curl http://<HOST_IP>:8000/api/sync`（API 代理）
11. Web 端登录：`http://<HOST_IP>:3000`（或通过 Kong `:8000`）
12. Android 端安装 APK，测试登录和同步

---

## 常用运维命令

```bash
# 查看服务状态
cd docker && docker compose ps

# 查看日志
docker logs readest-client --tail 50
docker logs supabase-auth --tail 50
docker logs supabase-kong --tail 50     # Kong 网关日志（排查路由问题）

# 重启单个服务
docker compose restart client

# 停止（保留数据）
docker compose down

# 查看数据库用户
docker exec -it supabase-db psql -U postgres -c "SELECT id, email FROM auth.users;"

# 查看 MinIO 文件
docker exec -it readest-minio mc ls myminio/readest-files/ --recursive
```
