## Readest 自部署运维手册

本文档面向负责维护 Readest 自建服务端的运维人员，以日常操作为主，覆盖服务启停、配置修改、备份恢复、常见问题排查和版本升级。

---

### 一、系统架构概览

Readest 自部署由 6 个容器组成，通过 Docker Compose 编排，容器间通过内部 `readest` 网络通信：

```
浏览器 ──▶ localhost:3000 ──▶ readest-client (Next.js 16)
                                  │
                                  ├──▶ localhost:8000 ──▶ supabase-kong (API 网关)
                                  │                           ├──▶ supabase-auth (GoTrue :9999)
                                  │                           └──▶ supabase-rest (PostgREST :3000)
                                  │                                    └──▶ supabase-db (PostgreSQL :5432)
                                  │
                                  └──▶ localhost:9000 ──▶ readest-minio (S3 对象存储)
                                       localhost:9001 ──▶ MinIO 管理控制台
```

| 容器名 | 角色 | 暴露端口 | 数据卷 |
|--------|------|---------|--------|
| `readest-client` | Web 前端 | 3000 | 无（无状态） |
| `supabase-kong` | API 网关 | 8000 | 无 |
| `supabase-auth` | 认证服务 | 无 | 无 |
| `supabase-rest` | REST API | 无 | 无 |
| `supabase-db` | 数据库 | 无 | `db-data`, `db-config` |
| `readest-minio` | 文件存储 | 9000, 9001 | `minio-data` |

---

### 二、日常操作命令

所有命令请在 `docker/` 目录下执行。

#### 2.1 启动服务

```bash
cd docker
docker compose up -d
```

首次启动会拉取镜像（约 2GB），耗时取决于网络速度。后续启动通常在 10 秒内完成。

#### 2.2 停止服务

```bash
# 停止但保留数据
docker compose down

# 停止并删除所有数据（危险！慎用）
docker compose down -v
```

#### 2.3 重启单个服务

```bash
# 例如重启认证服务
docker compose restart supabase-auth

# 重启前端
docker compose restart readest-client
```

#### 2.4 查看服务状态

```bash
docker ps --filter "name=readest" --filter "name=supabase" \
  --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

正常输出应看到所有容器均为 `Up` 状态，`supabase-db`、`supabase-kong`、`readest-minio` 显示 `healthy`。

#### 2.5 查看日志

```bash
# 查看所有服务日志（实时跟踪）
docker compose logs -f

# 查看指定服务
docker compose logs -f readest-client
docker compose logs -f supabase-auth
docker compose logs -f supabase-db
docker compose logs -f readest-minio
```

---

### 三、配置管理

配置文件位于 `docker/.env`，修改后需要重启相关服务才能生效。

#### 3.1 常用配置修改

**修改用户存储配额：**

```env
STORAGE_FIXED_QUOTA=2147483648    # 2GB（单位：字节）
TRANSLATION_FIXED_QUOTA=100000    # 翻译配额
```

修改后重启前端：`docker compose restart readest-client`

**关闭新用户注册：**

```env
DISABLE_SIGNUP=true
```

修改后重启认证服务：`docker compose restart supabase-auth`

**开启邮件验证（生产环境推荐）：**

```env
ENABLE_EMAIL_AUTOCONFIRM=false
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_ADMIN_EMAIL=noreply@your-domain.com
SMTP_SENDER_NAME=Readest
```

修改后重启认证服务：`docker compose restart supabase-auth`

#### 3.2 对外提供服务（配置域名和 HTTPS）

将 Readest 部署到公网时，需要：

1. 在 `.env` 中修改以下变量为你的实际域名：

```env
HOST_IP=your-domain.com
API_EXTERNAL_URL=https://your-domain.com:8000
SITE_URL=https://your-domain.com
ADDITIONAL_REDIRECT_URLS=https://your-domain.com/**,https://your-domain.com:8000/**
SUPABASE_PUBLIC_URL=https://your-domain.com:8000
```

2. 在前端容器前添加反向代理（Nginx/Caddy），配置 HTTPS 证书并转发到 `localhost:3000`。
3. 同样为 Kong（8000）和 MinIO（9000/9001）配置反向代理和 HTTPS。

> **注意：** `.env` 中 `HOST_IP` 和 `API_EXTERNAL_URL` 等变量的值必须与浏览器实际访问的地址一致，否则前端请求会因跨域或地址错误而失败。

#### 3.3 环境变量速查表

| 变量 | 作用 | 修改后需重启 |
|------|------|-------------|
| `POSTGRES_PASSWORD` | 数据库密码 | 全部服务（需清除 db-data 卷） |
| `JWT_SECRET` | JWT 签名密钥 | 全部服务（需重新生成 ANON_KEY 和 SERVICE_ROLE_KEY） |
| `JWT_EXPIRY` | Token 有效期（秒） | `supabase-auth` |
| `DISABLE_SIGNUP` | 禁止注册 | `supabase-auth` |
| `ENABLE_EMAIL_AUTOCONFIRM` | 邮箱自动确认 | `supabase-auth` |
| `SMTP_*` | 邮件服务器配置 | `supabase-auth` |
| `STORAGE_FIXED_QUOTA` | 用户存储配额 | `readest-client` |
| `TRANSLATION_FIXED_QUOTA` | 翻译配额 | `readest-client` |
| `MINIO_ROOT_PASSWORD` | MinIO 管理密码 | `readest-minio`（需清除 minio-data 卷） |
| `KONG_HTTP_PORT` | API 网关端口 | `supabase-kong` |

---

### 四、备份与恢复

#### 4.1 备份数据库

```bash
# 导出数据库到本地文件
docker exec supabase-db pg_dump -U postgres -d postgres \
  --clean --if-exists --no-owner \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 4.2 恢复数据库

```bash
# 先停止前端和 API 服务，避免写入冲突
docker compose stop readest-client supabase-auth supabase-rest

# 导入数据库
docker exec -i supabase-db psql -U postgres -d postgres < backup_20260604.sql

# 重启服务
docker compose start readest-client supabase-auth supabase-rest
```

#### 4.3 备份 MinIO 文件存储

MinIO 数据存储在 `minio-data` Docker 卷中。备份方法：

```bash
# 方法一：使用 MinIO mc 工具同步到本地
docker run --rm -v minio-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio_backup_$(date +%Y%m%d).tar.gz /data

# 方法二：直接复制卷数据（需停止 MinIO）
docker compose stop readest-minio
docker run --rm -v readest_minio-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio_backup.tar.gz /data
docker compose start readest-minio
```

#### 4.4 完整备份脚本

```bash
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "备份数据库..."
docker exec supabase-db pg_dump -U postgres -d postgres --clean --if-exists --no-owner \
  > "$BACKUP_DIR/database.sql"

echo "备份 MinIO 存储..."
docker exec supabase-db pg_dump -U postgres -d postgres -t files \
  > "$BACKUP_DIR/files_metadata.sql"

echo "备份 .env 配置..."
cp docker/.env "$BACKUP_DIR/.env"

echo "备份完成: $BACKUP_DIR"
```

---

### 五、数据库迁移

仓库中 `docker/volumes/db/migrations/` 包含数据库迁移脚本（001 到 013），初始部署时 `schema.sql` 已包含基础表结构，但后续功能的迁移需要手动执行。

#### 5.1 查看已执行的迁移

```bash
docker exec supabase-db psql -U postgres -d postgres -c "\dt public.*"
```

如果看到 `book_shares`、`replicas`、`replica_keys`、`send_addresses` 等表，说明迁移已包含在初始 schema 中。

#### 5.2 手动执行迁移

如果某张表缺失，按编号顺序执行：

```bash
docker exec -i supabase-db psql -U postgres -d postgres \
  < docker/volumes/db/migrations/002_add_book_shares.sql
```

---

### 六、常见问题排查

#### 6.1 所有容器都在运行，但网页打不开

```bash
# 检查前端日志
docker compose logs readest-client --tail 50

# 检查端口是否被占用
# Windows:
powershell -Command "Get-NetTCPConnection -LocalPort 3000"
# Linux/macOS:
lsof -i :3000
```

常见原因：端口被其他程序占用，修改 `.env` 中端口映射或停止冲突程序。

#### 6.2 注册/登录失败

```bash
# 检查认证服务日志
docker compose logs supabase-auth --tail 30
```

常见原因：
- JWT 密钥配置错误 → 确认 `ANON_KEY` 和 `SERVICE_ROLE_KEY` 是用 `JWT_SECRET` 签名的 HS256 JWT
- Kong 网关未正确转发 → 测试 `curl http://localhost:8000/auth/v1/health -H "apikey: $ANON_KEY"`

#### 6.3 书籍文件上传失败

```bash
# 检查 MinIO 状态
docker compose logs readest-minio --tail 20

# 检查 MinIO bucket 是否创建成功
docker compose logs readest-minio-setup-1
```

常见原因：
- MinIO 存储桶未创建 → 重新运行 setup 容器：`docker compose up minio-setup`
- 文件超过用户配额 → 调大 `STORAGE_FIXED_QUOTA`

#### 6.4 数据库连接失败

```bash
# 检查数据库状态
docker compose logs supabase-db --tail 30

# 检查数据库是否接受连接
docker exec supabase-db pg_isready -U postgres
```

常见原因：
- 首次启动数据库尚未完成初始化 → 等待 30 秒后重启依赖它的服务
- 密码错误 → `POSTGRES_PASSWORD` 需至少 32 字符

#### 6.5 容器反复重启

```bash
# 查看退出原因
docker inspect --format '{{.State.ExitCode}} {{.State.Error}}' <容器名>

# 查看详细日志
docker compose logs --tail 100 <服务名>
```

#### 6.6 客户端登录一段时间后过期（"login expired"）

**现象：** 用户在 Android/Windows 客户端登录后约 1 小时，客户端提示登录已过期，需要重新登录。

**原因：** 此前版本中，`AuthContext` 的认证状态监听器（auth listener）在 Supabase 客户端重新初始化后变为陈旧引用，无法正确接收 token 刷新事件，导致会话在 JWT 过期后失效。

**解决方案：**
1. 确认客户端已更新到最新版本（该问题已在前端代码中修复）。
2. 如需临时缓解，可在 `.env` 中调大 `JWT_EXPIRY`（单位：秒），例如设置为 `36000`（10 小时），然后重启 `supabase-auth`。

```bash
# 修改 JWT 过期时间后重启认证服务
docker compose restart supabase-auth
```

#### 6.7 客户端同步失败（"sync failed"）— Kong `/api/*` 路由问题

**现象：** Android 或 Windows 客户端无法同步、上传或下载书籍，提示网络错误或 404。

**原因：** 客户端向导中配置的 `apiBaseUrl` 指向了 Kong 网关地址（端口 8000），但 Kong 的 `/api/*` 路由未正确配置或已被移除，导致同步相关请求无法被转发到后端。

**验证方法：** 使用以下 curl 命令测试 Kong 网关的 `/api/` 路由是否正常工作：

```bash
curl -H "apikey: $ANON_KEY" http://HOST:8000/api/sync?since=0
```

- **预期结果：** 返回 HTTP 401（未授权），说明路由正常，Kong 已正确转发请求到后端。
- **如果返回 404：** 说明 `/api/*` 路由缺失或未生效，需要检查 Kong 的路由配置。
- **如果返回 502/503：** 说明路由正常但后端服务不可用，检查 `supabase-auth`、`supabase-rest`、`supabase-db` 等容器状态。

**排查步骤：**

```bash
# 1. 检查 Kong 网关是否正常运行
docker compose logs supabase-kong --tail 20

# 2. 测试认证端点（应返回 200）
curl http://localhost:8000/auth/v1/health -H "apikey: $ANON_KEY"

# 3. 测试 API 同步端点（应返回 401，非 404）
curl -H "apikey: $ANON_KEY" http://localhost:8000/api/sync?since=0

# 4. 如果 404，检查 Kong 配置文件中的路由规则
docker compose exec supabase-kong cat /usr/local/kong/declarative/kong.yml | grep -A 5 '/api'
```

> **注意：** 客户端向导只需要填写一个地址——Kong 网关 URL（例如 `http://<服务器IP>:8000`）。无需单独配置 REST、Auth、MinIO 等各个服务的地址。Kong 负责将所有客户端请求按路径前缀分发到对应的后端服务。

---

### 七、版本升级

#### 7.1 升级 Readest 前端（拉取新镜像）

```bash
cd docker
docker compose pull readest-client
docker compose up -d readest-client
```

#### 7.2 从源码构建前端（需要自定义修改时）

```bash
cd docker
docker compose -f compose.yaml -f compose.build.yaml up --build -d readest-client
```

#### 7.3 升级 Supabase 组件

修改 `compose.yaml` 中对应服务的镜像版本号，然后：

```bash
docker compose pull supabase-auth supabase-rest supabase-db
docker compose up -d supabase-auth supabase-rest supabase-db
```

> **重要：** 升级 PostgreSQL 主版本前，务必先做完整数据库备份。跨主版本升级需要 `pg_dump` / `pg_restore`。

#### 7.4 执行数据库迁移

升级后如果有新的迁移脚本：

```bash
docker exec -i supabase-db psql -U postgres -d postgres \
  < docker/volumes/db/migrations/NNN_xxx.sql
```

---

### 八、安全加固建议

#### 8.1 生产环境必做项

1. **更换所有默认密码** — `POSTGRES_PASSWORD`、`MINIO_ROOT_PASSWORD`、`JWT_SECRET` 务必使用强随机密码
2. **关闭自动邮箱确认** — 设置 `ENABLE_EMAIL_AUTOCONFIRM=false` 并配置真实 SMTP
3. **配置 HTTPS** — 所有对外端口必须通过 TLS 加密
4. **限制 MinIO 控制台** — 9001 端口不应暴露到公网
5. **定期备份** — 建议每天自动备份数据库，每周备份 MinIO 存储

#### 8.2 防火墙规则建议

仅对外暴露以下端口：

| 端口 | 用途 |
|------|------|
| 443 | HTTPS（反向代理） |
| 80 | HTTP（重定向到 HTTPS） |

内部端口 3000、8000、9000、9001、5432 均不应直接暴露到公网。

---

### 九、监控

#### 9.1 简易健康检查脚本

可以配合 cron 定时执行：

```bash
#!/bin/bash
SERVICES=("readest-client" "supabase-db" "supabase-kong" "supabase-auth" "supabase-rest" "readest-minio")

for svc in "${SERVICES[@]}"; do
  status=$(docker inspect --format '{{.State.Status}}' "$svc" 2>/dev/null)
  if [ "$status" != "running" ]; then
    echo "[ALERT] $svc is $status" | mail -s "Readest Alert" admin@your-domain.com
  fi
done

# 检查前端响应
http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$http_code" != "200" ]; then
  echo "[ALERT] Readest client returned $http_code" | mail -s "Readest Alert" admin@your-domain.com
fi

# 检查 Kong /api/* 路由是否正常（应返回 401，非 404）
api_code=$(curl -s -o /dev/null -w "%{http_code}" -H "apikey: $ANON_KEY" http://localhost:8000/api/sync?since=0)
if [ "$api_code" == "404" ]; then
  echo "[ALERT] Kong /api/* route returned 404 — sync route may be missing" | mail -s "Readest Alert" admin@your-domain.com
fi
```

#### 9.2 资源使用查看

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
  $(docker ps --filter "name=readest" --filter "name=supabase" -q)
```
