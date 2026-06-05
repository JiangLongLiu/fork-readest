## Readest 自建服务器 Docker 部署指南

本文档记录了 Readest 自建服务器的 Docker 部署完整经验，涵盖架构理解、环境配置、服务启动、问题排查等方面。所有配置细节均经过源文件交叉验证。

> **注意**：本项目的 Docker Compose 主文件名为 `compose.yaml`（而非传统的 `docker-compose.yml`），位于 `docker/` 目录下。Docker Compose V2 会自动识别两种命名。

---

### 一、服务架构总览

Readest 自建服务器由 7 个 Docker 容器组成，分为四层。**Kong API 网关作为所有客户端流量的统一入口**，代理认证、REST 和 Next.js 应用请求：

```
                    ┌─────────────────────────────────────────────────────┐
                    │               客户端访问层（对外端口）                 │
                    │                                                     │
                    │  :8000 Kong API 网关（统一入口）                     │
                    │      ├── /auth/v1/*  → GoTrue 认证服务              │
                    │      ├── /rest/v1/*  → PostgREST 数据库 API         │
                    │      └── /api/*      → Next.js 客户端应用            │
                    │  :9000 MinIO S3 API        :9001 MinIO 控制台       │
                    │  :9002 Nginx S3 代理（presigned URL）               │
                    └─────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────────────────────────────────┐
                    │               应用服务层                             │
                    │                                                     │
                    │  kong (API 网关) ─┬── auth (GoTrue)                 │
                    │       │          ├── rest (PostgREST)               │
                    │       │          └── client (Next.js)               │
                    │       │                                             │
                    │  client (Next.js) ──→ minio (S3 存储)               │
                    └─────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────────────────────────────────┐
                    │               数据层                                │
                    │                                                     │
                    │  db (PostgreSQL 15)    minio-data (S3 文件存储)      │
                    └─────────────────────────────────────────────────────┘
```

各服务详情：

| 服务 | 容器名 | 镜像 | 对外端口 | 作用 |
|------|--------|------|----------|------|
| **client** | readest-client | `ghcr.io/readest/readest:latest` | 无（内部 3000） | Readest 前端 UI + API 路由（sync、storage 等），通过 Kong 网关访问 |
| **kong** | supabase-kong | `kong:2.8.1` | 8000 | API 网关（统一入口），路由 `/auth/v1/*` 到 GoTrue，`/rest/v1/*` 到 PostgREST，`/api/*` 到 Next.js client |
| **auth** | supabase-auth | `supabase/gotrue:v2.185.0` | 无（内部 9999） | 用户认证服务，管理注册、登录、JWT 令牌 |
| **rest** | supabase-rest | `postgrest/postgrest:v14.3` | 无（内部 3000） | PostgreSQL REST API，自动将数据库表暴露为 REST 端点 |
| **db** | supabase-db | `supabase/postgres:15.8.1.085` | 无（内部 5432） | PostgreSQL 数据库 |
| **minio** | readest-minio | `minio/minio` | 9000, 9001 | S3 兼容对象存储，存放书籍文件和封面 |
| **nginx-s3-proxy** | readest-nginx-s3 | `nginx:alpine` | 9002 | MinIO 的 CORS 代理，为浏览器 presigned URL 访问服务 |

此外还有一个一次性容器 **minio-setup**（`minio/mc`），在 MinIO 健康启动后自动创建 S3 bucket，完成后退出。

---

### 二、关键架构设计：S3 双端点模式

这是自建部署中最容易配错的部分。Readest 的 S3 存储使用了**双端点设计**：

```
浏览器/客户端                                    Docker 内部
    │                                              │
    │  上传/下载文件                                 │  服务端 SDK 操作
    │  (presigned URL)                              │  (PutObject, CopyObject)
    │                                              │
    ▼                                              ▼
┌──────────────┐                            ┌──────────────┐
│ nginx-s3     │   proxy_pass               │    MinIO     │
│ :9002        │ ──────────────────→        │    :9000     │
│ (CORS 代理)   │   http://minio:9000       │              │
└──────────────┘                            └──────────────┘
     ▲                                            ▲
     │                                            │
S3_PUBLIC_ENDPOINT                          S3_ENDPOINT
http://<HOST_IP>:9002                      http://minio:9000
```

**`S3_ENDPOINT`**（`http://minio:9000`）：Docker 内部地址，供 client 容器的服务端代码通过 S3 SDK 执行 PutObject、CopyObject、HeadObject 等操作。客户端浏览器无法访问这个地址。

**`S3_PUBLIC_ENDPOINT`**（`http://<HOST_IP>:9002`）：外部可达地址，用于生成 presigned URL。presigned URL 中嵌入的域名必须是浏览器能访问的，如果用了内部地址 `minio:9000`，浏览器的上传/下载请求会失败。

**nginx-s3-proxy** 的作用：MinIO 自身的 CORS 处理在某些场景下不够完善（特别是 presigned URL 场景），所以在前面加了一层 nginx 代理，统一处理 CORS 头。它做了三件事：
1. 添加 `Access-Control-Allow-Origin: *` 等 CORS 响应头
2. 处理 OPTIONS 预检请求（直接返回 204）
3. 剥离 MinIO 自带的 CORS 头，避免重复

如果 presigned URL 生成时使用了错误的端点，表现为：文件上传进度条卡住、封面图片加载不出来、书籍下载失败。

---

### 三、`.env` 配置详解

以下是 `docker/.env` 的完整配置说明。从 `.env.example` 复制后，逐项修改：

```env
# ==================== 网络地址 ====================
# 服务器对外可达的 IP 地址（所有客户端 URL 都基于此生成）
# 本地部署用 localhost，远程部署用服务器 IP 或 Tailscale IP
HOST_IP=100.108.143.105

# 客户端镜像（默认拉取官方镜像）
READEST_IMAGE=ghcr.io/readest/readest:latest

# ==================== 数据库 ====================
# PostgreSQL 密码，建议 32+ 字符的强密码
POSTGRES_PASSWORD=<你的数据库密码>
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# ==================== JWT 认证 ====================
# JWT 签名密钥，建议 64+ 字符的随机字符串
JWT_EXPIRY=3600
JWT_SECRET=<你的 JWT 密钥>

# 以下两个 JWT 需要用 JWT_SECRET 签名生成（HS256 算法）
# ANON_KEY payload: {"role": "anon"}
# SERVICE_ROLE_KEY payload: {"role": "service_role"}
# 可用 https://jwt.io 在线生成，或用命令行工具
ANON_KEY=<用 JWT_SECRET 签名的 {"role":"anon"} JWT>
SERVICE_ROLE_KEY=<用 JWT_SECRET 签名的 {"role":"service_role"} JWT>

# Kong 网关对外端口
KONG_HTTP_PORT=8000

# ==================== 认证服务（GoTrue）====================
# 以下 URL 中的 HOST_IP 和端口必须与客户端访问时使用的一致
API_EXTERNAL_URL=http://<HOST_IP>:8000
SITE_URL=http://<HOST_IP>:3000
ADDITIONAL_REDIRECT_URLS=http://localhost:3000/**,http://localhost:8000/**,http://<HOST_IP>:3000/**,http://<HOST_IP>:8000/**,readest://auth-callback

# 注册和邮箱配置
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true      # 设为 true 则注册后自动确认，无需 SMTP
ENABLE_ANONYMOUS_USERS=false

# SMTP（ENABLE_EMAIL_AUTOCONFIRM=false 时才需要）
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_SENDER_NAME=Readest

# ==================== PostgREST ====================
PGRST_DB_SCHEMAS=public,graphql_public

# ==================== S3 存储（MinIO）====================
OBJECT_STORAGE_TYPE=s3
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<你的 MinIO 密码>
S3_BUCKET_NAME=readest-files

# ==================== 配额 ====================
# 自建部署所有用户统一使用此固定配额（单位：字节）
# 设为 0 则回退到 free plan 的 500MB（不推荐）
# 常用值：1GB=1073741824, 5GB=5368709120, 10GB=10737418240, 20GB=21474836480, 50GB=53687091200
STORAGE_FIXED_QUOTA=21474836480    # 20GB 存储配额（当前实际配置）
TRANSLATION_FIXED_QUOTA=50000      # 5万次翻译配额
```

#### 3.1 JWT 密钥生成方法

`ANON_KEY` 和 `SERVICE_ROLE_KEY` 是用 `JWT_SECRET` 签名的 HS256 JWT。生成方法：

**方式 1 — jwt.io 网站**：打开 https://jwt.io，Algorithm 选 HS256，Payload 分别填 `{"role": "anon"}` 和 `{"role": "service_role"}`，Secret 填你的 `JWT_SECRET`，复制生成的 token。

**方式 2 — 命令行**（需要 `jwt` 工具或 Node.js）：

```bash
# 使用 Node.js 生成
node -e "
const jwt = require('jsonwebtoken');
const secret = '你的JWT_SECRET';
console.log('ANON_KEY:', jwt.sign({role:'anon'}, secret));
console.log('SERVICE_ROLE_KEY:', jwt.sign({role:'service_role'}, secret));
"
```

#### 3.2 ADDITIONAL_REDIRECT_URLS 说明

`ADDITIONAL_REDIRECT_URLS` 控制 GoTrue 认证完成后允许重定向到的 URL 列表。自建场景下需要包含：

- `http://<HOST_IP>:3000/**` — Web 端回调
- `http://<HOST_IP>:8000/**` — Kong 网关回调
- `readest://auth-callback` — Android/iOS 深度链接回调（**移动端登录必须包含此项**）
- `http://localhost:3000/**` 和 `http://localhost:8000/**` — 本地开发用

---

### 四、compose.yaml 中的内部通信

`compose.yaml` 中各服务之间的内部通信关系如下（这些由 Docker Compose 自动配置，一般无需修改）：

| 来源 | 目标 | 地址 | 用途 |
|------|------|------|------|
| client | kong | `http://kong:8000` | 服务端调用 Supabase auth/REST API（`SUPABASE_URL`） |
| client | minio | `http://minio:9000` | 服务端 S3 SDK 操作（`S3_ENDPOINT`） |
| kong | auth | `http://auth:9999` | 路由 `/auth/v1/*` 请求 |
| kong | rest | `http://rest:3000` | 路由 `/rest/v1/*` 请求 |
| kong | client | `http://client:3000` | 路由 `/api/*` 请求（sync、storage 等 Next.js API） |
| auth | db | `postgres://supabase_auth_admin:<密码>@db:5432/postgres` | 用户认证数据库 |
| rest | db | `postgres://authenticator:<密码>@db:5432/postgres` | REST API 数据库查询 |
| nginx-s3-proxy | minio | `http://minio:9000` | 反向代理到 MinIO |

注意 client 服务中的两个 Supabase URL 配置：

```yaml
environment:
  SUPABASE_URL: http://kong:8000                        # 服务端内部调用
  SUPABASE_PUBLIC_URL: http://${HOST_IP}:${KONG_HTTP_PORT}  # 返回给客户端的公开 URL
```

`SUPABASE_URL` 是 client 容器的服务端代码用来直接调 Kong 的内部地址。`SUPABASE_PUBLIC_URL` 是返回给浏览器/移动端的地址，必须使用外部可达的 IP。

---

### 五、Kong API 网关路由规则

Kong 使用声明式配置（`volumes/api/kong.yml`），无需数据库。**Kong 作为所有客户端请求的统一入口点**，客户端只需配置一个 URL（Kong 网关地址）即可访问所有服务。路由规则：

| 外部路径 | 内部目标 | 认证要求 | 说明 |
|----------|----------|----------|------|
| `/auth/v1/health` | `http://auth:9999/health` | 无 | 健康检查 |
| `/auth/v1/verify` | `http://auth:9999/verify` | 无 | 邮箱验证 |
| `/auth/v1/callback` | `http://auth:9999/callback` | 无 | OAuth 回调 |
| `/auth/v1/authorize` | `http://auth:9999/authorize` | 无 | OAuth 授权 |
| `/auth/v1/*`（其余） | `http://auth:9999/` | apikey（anon 或 admin） | 登录、注册等 |
| `/rest/v1/*` | `http://rest:3000/` | apikey（anon 或 admin） | 数据库 REST API |
| `/api/*` | `http://client:3000/` | 无（由 Next.js 应用层处理） | Next.js API 路由（sync、storage 等），CORS 配置 `origins: ['*'], credentials: true` |

所有需要认证的端点要求请求头包含 `apikey`，值为 `ANON_KEY` 或 `SERVICE_ROLE_KEY`。Kong 通过 key-auth 插件验证后，将请求转发到后端服务。

**优势**：客户端只需配置 Kong 网关的 URL（`http://<HOST_IP>:8000`），无需分别记住多个服务地址。所有认证、REST 查询和 Next.js API 调用都通过同一个端口访问，简化了客户端配置和网络策略。

---

### 六、数据库 Schema

数据库在首次启动时自动初始化（通过 Docker entrypoint 脚本），按文件名排序依次执行：

1. **`99-jwt.sql`**（`jwt.sql`）：配置 PostgreSQL 的 JWT 签名密钥和过期时间
2. **`99-roles.sql`**（`roles.sql`）：设置 Supabase 内置角色（authenticator、pgbouncer、supabase_auth_admin、supabase_storage_admin）的密码
3. **`100-schema.sql`**（`schema.sql`）：创建核心数据表

核心数据表结构：

| 表名 | 主键 | 用途 |
|------|------|------|
| `public.books` | (user_id, book_hash) | 书籍元数据（标题、作者、标签、阅读状态等） |
| `public.book_configs` | (user_id, book_hash) | 阅读配置（位置、进度、视图设置等） |
| `public.book_notes` | (user_id, book_hash, id) | 笔记和标注（高亮、批注等） |
| `public.files` | id (uuid) | 文件记录（file_key、file_size，关联 S3 存储） |

所有表都启用了 RLS（Row Level Security），只有认证用户能访问自己的数据。数据表通过外键关联到 `auth.users`（GoTrue 管理的用户表），并设置了 `ON DELETE CASCADE`。

此外还有 13 个增量迁移文件（`migrations/001` 到 `013`），逐步添加 RSVP 阅读位置、书籍分享、副本同步、OPDS 目录、Send to Readest 等功能。这些迁移在数据库首次启动时一并执行。

---

### 七、服务端 API 端点

client 服务（Next.js）除了提供前端 UI 外，还承载了以下 API 路由（端口 3000）：

#### 7.1 同步 API（`/api/sync`）

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/sync` | `since`（时间戳，必填）、`type`（books/configs/notes）、`book`（book_hash） | 拉取自 `since` 时间以来变更的记录 |
| POST | `/api/sync` | body: `{books, configs, notes}` 数组 | 推送本地变更到服务端 |

请求头需要 `Authorization: Bearer <access_token>`。

#### 7.2 存储 API（`/api/storage/*`）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/storage/upload` | 获取上传 presigned URL。body: `{fileName, fileSize, bookHash}` |
| GET | `/api/storage/download?fileKey=xxx` | 获取单个文件的下载 presigned URL |
| POST | `/api/storage/download` | 批量获取下载 URL。body: `{fileKeys: [...]}` |
| GET | `/api/storage/list` | 列出用户的文件 |
| POST | `/api/storage/delete` | 删除文件（软删除） |
| POST | `/api/storage/purge` | 永久删除已软删除的文件 |
| GET | `/api/storage/stats` | 获取存储用量统计 |

上传流程：客户端 POST `/api/storage/upload` → 服务端检查存储配额 → 在 `files` 表插入记录 → 返回 MinIO presigned upload URL → 客户端直接 PUT 文件到该 URL。

下载流程：客户端 GET `/api/storage/download?fileKey=xxx` → 服务端验证文件归属 → 生成 presigned download URL（使用 `S3_PUBLIC_ENDPOINT`） → 客户端直接从该 URL 下载。

#### 7.3 其他 API

| 路径 | 说明 |
|------|------|
| `/api/share/*` | 书籍分享（创建分享链接、导入分享、下载等） |
| `/api/deepl/translate` | DeepL 翻译代理 |
| `/api/metadata/search` | 书籍元数据搜索 |
| `/api/opds/proxy` | OPDS 目录代理 |
| `/api/tts/edge` | Edge TTS 语音合成 |
| `/api/send/*` | Send to Readest（邮件/浏览器扩展发送） |
| `/api/user/delete` | 用户删除 |

---

### 八、部署步骤

#### 8.1 前置条件

- Docker 和 Docker Compose 已安装
- 项目代码已克隆，且 git 子模块已初始化：
  ```bash
  git submodule update --init packages/foliate-js packages/simplecc-wasm
  ```

#### 8.2 配置 .env

```bash
cd docker
cp .env.example .env
# 编辑 .env，按照第三节的说明填写各项配置
```

#### 8.3 启动服务

```bash
cd docker
docker compose up -d
```

首次启动会拉取所有镜像并初始化数据库。`minio-setup` 容器会自动创建 S3 bucket（`readest-files`），完成后自动退出。

#### 8.4 验证启动状态

```bash
docker compose ps
```

所有长期运行的服务（db、kong、auth、rest、minio、nginx-s3-proxy、client）应显示 `Up` 状态。其中 db、kong、minio 应显示 `healthy`。

#### 8.5 验证 API 可达性

```bash
# 1. 检查 Kong 网关
curl http://<HOST_IP>:8000/auth/v1/health

# 2. 测试登录
curl -X POST "http://<HOST_IP>:8000/auth/v1/token?grant_type=password" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"your_password"}'

# 3. 检查 client 服务（通过 Kong 网关代理）
curl http://<HOST_IP>:8000/api/sync

# 4. 检查 MinIO 控制台
# 浏览器打开 http://<HOST_IP>:9001
```

---

### 九、踩坑记录

#### 坑 1：CORS 错误 — 浏览器无法访问 presigned URL

**现象**：书籍上传进度条卡住，封面图片加载失败，浏览器控制台报 CORS 错误。

**根因**：presigned URL 中使用了 MinIO 的内部地址（`http://minio:9000`），浏览器无法解析 Docker 内部主机名。

**解决**：在 `compose.yaml` 的 client 服务中确保 `S3_PUBLIC_ENDPOINT` 使用外部可达地址（`http://<HOST_IP>:9002`），并确认 nginx-s3-proxy 服务正常运行。

#### 坑 2：ADDITIONAL_REDIRECT_URLS 缺少移动端回调

**现象**：Web 端登录正常，但 Android/iOS 端登录后无法回调。

**根因**：GoTrue 的 `GOTRUE_URI_ALLOW_LIST` 未包含 `readest://auth-callback`，认证完成后无法重定向到移动端的自定义 scheme。

**解决**：在 `.env` 的 `ADDITIONAL_REDIRECT_URLS` 中添加 `readest://auth-callback`。

#### 坑 3：JWT_SECRET 与 ANON_KEY 不匹配

**现象**：所有 API 请求返回 401 Unauthorized。

**根因**：更换了 `JWT_SECRET` 但没有重新签名 `ANON_KEY` 和 `SERVICE_ROLE_KEY`。这两个 key 本质上是 JWT token，必须用相同的 secret 签名。

**解决**：每次更换 `JWT_SECRET` 后，必须重新生成 `ANON_KEY` 和 `SERVICE_ROLE_KEY`（见第三节 3.1）。

#### 坑 4：数据库密码太短导致启动失败

**现象**：PostgreSQL 容器启动后立即退出，或 GoTrue 连接数据库失败。

**根因**：Supabase PostgreSQL 对密码有最低长度要求（32 字符以上）。使用弱密码或默认密码会导致认证失败。

**解决**：`POSTGRES_PASSWORD` 使用 32+ 字符的随机字符串。

#### 坑 5：MinIO bucket 未创建

**现象**：上传文件时返回 404 NoSuchBucket 错误。

**根因**：`minio-setup` 容器在 MinIO 还没完全就绪时就尝试创建 bucket，或者 `S3_BUCKET_NAME` 在 `.env` 和 `compose.yaml` 之间不一致。

**解决**：`compose.yaml` 中 `minio-setup` 已配置了 `depends_on: minio: condition: service_healthy`，确保 MinIO 健康后才执行。如果仍有问题，可以手动创建：

```bash
docker exec -it readest-minio mc alias set myminio http://localhost:9000 minioadmin <密码>
docker exec -it readest-minio mc mb --ignore-existing myminio/readest-files
```

#### 坑 6：HOST_IP 变更后需要全面更新

**现象**：更换服务器 IP 后，部分功能正常但另一些失败。

**根因**：`HOST_IP` 影响了多个服务的 URL 生成。需要更新的位置包括：

- `.env` 中的 `HOST_IP`、`API_EXTERNAL_URL`、`SITE_URL`、`ADDITIONAL_REDIRECT_URLS`
- 如果客户端（Android APK、桌面应用）中硬编码了服务器地址，也需要重新编译客户端

**解决**：修改 `.env` 中的 `HOST_IP` 后，重启所有服务（`docker compose down && docker compose up -d`），并检查客户端配置是否需要同步更新。

---

### 十、运维命令速查

```bash
# 查看所有服务状态
docker compose ps

# 查看某个服务的日志
docker logs readest-client --tail 50
docker logs supabase-auth --tail 50
docker logs supabase-kong --tail 50

# 重启单个服务
docker compose restart client

# 停止所有服务（保留数据）
docker compose down

# 停止并删除数据（慎用，会清除数据库和文件存储）
docker compose down -v

# 更新客户端镜像
docker compose pull client
docker compose up -d client

# 查看数据库中的用户
docker exec -it supabase-db psql -U postgres -c "SELECT id, email FROM auth.users;"

# 查看 MinIO 中的文件
docker exec -it readest-minio mc ls myminio/readest-files/ --recursive

# 查看数据库中的书籍记录
docker exec -it supabase-db psql -U postgres \
  -c "SELECT user_id, book_hash, title, format FROM public.books LIMIT 20;"
```

---

### 十一、与客户端的对接

服务端部署完成后，客户端需要配置以下地址才能连接：

| 客户端类型 | 配置文件 | 需要的地址 |
|-----------|----------|-----------|
| **Android APK** | `apps/readest-app/.env.tauri` | `NEXT_PUBLIC_SUPABASE_URL=http://<HOST_IP>:8000`、`NEXT_PUBLIC_API_BASE_URL=http://<HOST_IP>:8000`、`S3_ENDPOINT=http://<HOST_IP>:9000` |
| **Windows 桌面** | `apps/readest-app/.env.tauri` | 同上 |
| **Web 浏览器** | 运行时环境变量 | 直接访问 `http://<HOST_IP>:8000` 即可，Kong 网关会路由所有请求 |

**重要变化**：由于 Kong 网关现在代理 `/api/*` 请求，客户端只需配置一个基础 URL（`http://<HOST_IP>:8000`）。`NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_API_BASE_URL` 都指向 Kong 网关，Kong 会根据路径自动路由到对应的后端服务：
- `/auth/v1/*` → GoTrue 认证服务
- `/rest/v1/*` → PostgREST 数据库 API
- `/api/*` → Next.js 客户端应用（sync、storage 等）

Web 端的特殊之处：client 容器从运行时环境变量（`SUPABASE_PUBLIC_URL`、`SUPABASE_ANON_KEY` 等）读取配置，因此只要 `.env` 正确，拉取的预编译镜像也能正确工作，无需重新编译 Docker 镜像。但 Android/Windows 客户端的地址是编译时嵌入的，修改服务器地址后需要重新编译客户端。

---

### 十二、本地开发模式

如果需要热重载开发，使用 `compose.dev.yaml` 叠加配置：

```bash
cd docker
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
```

这会：
1. 将 client 服务的构建目标切换到 `development-stage`（Next.js dev server）
2. 将本地代码目录挂载到容器内，实现热重载
3. 使用匿名卷覆盖容器内的 `node_modules` 等目录，确保使用容器内安装的依赖

前提条件：git 子模块必须已初始化（`packages/foliate-js` 和 `packages/simplecc-wasm`）。

---

### 附录：关键文件路径清单

以下列出本次实际部署中使用的所有关键文件的完整绝对路径，便于在其他机器上复现时快速定位和修改。

**项目根目录**：`C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy`

> 在其他机器上部署时，将下方路径中的项目根目录替换为实际路径即可。

#### Docker 编排与配置

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| **compose.yaml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\compose.yaml` | Docker Compose 主编排文件，定义全部 8 个服务 |
| **.env** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\.env` | 环境变量（HOST_IP、密码、JWT 密钥等），**部署时必须修改** |
| **.env.example** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\.env.example` | 环境变量模板，供复制参考 |
| **compose.build.yaml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\compose.build.yaml` | 本地构建 client 镜像的叠加配置 |
| **compose.dev.yaml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\compose.dev.yaml` | 开发模式叠加配置（热重载） |

#### Nginx 与 Kong

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| **nginx-s3-proxy.conf** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\nginx-s3-proxy.conf` | Nginx S3 代理配置（CORS 处理） |
| **kong.yml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\volumes\api\kong.yml` | Kong API 网关声明式路由配置 |

#### 数据库初始化

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| **schema.sql** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\volumes\db\init\schema.sql` | 核心数据表（books、book_configs、book_notes、files） |
| **jwt.sql** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\volumes\db\jwt.sql` | PostgreSQL JWT 密钥配置 |
| **roles.sql** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\volumes\db\roles.sql` | Supabase 内置角色密码设置 |
| **migrations/** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\docker\volumes\db\migrations\` | 13 个增量迁移文件（001-013） |

#### Dockerfile

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| **Dockerfile** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\Dockerfile` | client 镜像多阶段构建（dependencies → development → build → production） |

#### 服务端 API 源码（关键文件）

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| **sync.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\sync.ts` | 同步 API（GET 拉取 / POST 推送） |
| **upload.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\storage\upload.ts` | 文件上传（生成 presigned URL） |
| **download.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\pages\api\storage\download.ts` | 文件下载（生成 presigned URL） |
| **s3.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\utils\s3.ts` | S3 客户端（双端点：内部 SDK + 外部签名） |
| **object.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\utils\object.ts` | 存储抽象层（S3/R2 切换） |
| **supabase.ts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src\utils\supabase.ts` | Supabase 客户端创建（admin/client） |

#### 客户端编译配置（Android/Windows）

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| **.env.tauri** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\.env.tauri` | Tauri 客户端编译时的服务器地址（`NEXT_PUBLIC_*`） |
| **.env.tauri.local** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\.env.tauri.local` | 本地编译覆盖配置 |
| **build.gradle.kts** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src-tauri\gen\android\app\build.gradle.kts` | Android Gradle 构建（usesCleartextTraffic、签名） |
| **tauri.conf.json** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src-tauri\tauri.conf.json` | Tauri 主配置（frontendDist、SDK 版本） |
| **AndroidManifest.xml** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src-tauri\gen\android\app\src\main\AndroidManifest.xml` | Android 清单（权限、deep link） |
| **keystore.properties** | `C:\Users\liujianglong\.qoderworkcn\workspace\mpz6q4gevyax8b1y\readest-deploy\apps\readest-app\src-tauri\gen\android\keystore.properties` | APK 签名配置（需手动创建） |
