## Readest oec-4-fnOS 部署进度跟踪

### 进度记录

| 步骤 | 状态 | 时间 | 备注 |
|------|------|------|------|
| 1. 创建目录结构 | ✅ 完成 | 2026-06-05 16:30 | docs/scripts/config 子目录已创建 |
| 2. 创建 git 分支 | ✅ 完成 | 2026-06-05 16:32 | oec-4-fnOS-deploy 从 self-hosted-deploy 分出 |
| 3. 远程端口检测 | ✅ 完成 | 2026-06-05 16:35 | 8000/9000/9001/9002 均空闲; 5432 被宿主机 postgres 占用但容器内不冲突 |
| 4. 确认镜像架构 | ✅ 完成 | 2026-06-05 16:40 | 确认 supabase/postgres:15.8.1.085 支持 arm64, 改用此镜像 |
| 5. docker-compose.yml | ✅ 完成 | 2026-06-05 16:45 | bind mounts 替代 named volumes, db healthcheck 已添加 |
| 6. .env 配置 | ✅ 完成 | 2026-06-05 16:48 | HOST_IP=100.110.75.2, PGRST_DB_SCHEMAS=public |
| 7. 复制辅助配置 | ✅ 完成 | 2026-06-05 16:50 | kong.yml, nginx-s3-proxy.conf, SQL 初始化脚本, 13个迁移文件 |
| 8. SCP 上传配置 | ✅ 完成 | 2026-06-05 16:55 | 20 个文件上传至 /vol1/docker/mycontainers/readest |
| 9. 配置 Docker 代理 | ✅ 完成 | 2026-06-05 17:00 | systemd drop-in 配置代理 192.168.123.222:7890 |
| 10. 拉取镜像 | ✅ 完成 | 2026-06-05 17:15 | 所有镜像通过代理拉取成功 |
| 11. 启动容器(首次) | ✅ 完成 | 2026-06-05 17:20 | 8 个容器启动, 但 auth 服务崩溃 |
| 12. 修复 auth 错误 | ✅ 完成 | 2026-06-05 17:35 | 修复 schema.sql: 添加 ALTER FUNCTION auth.email() OWNER TO |
| 13. 修复 REST 错误 | ✅ 完成 | 2026-06-05 17:40 | 修复 .env: PGRST_DB_SCHEMAS=public (移除 graphql_public) |
| 14. 重启验证 | ✅ 完成 | 2026-06-05 17:45 | 全部 8 容器运行正常, API 端点可达 |
| 15. 脱敏并提交 | ✅ 完成 | 2026-06-05 17:50 | compose.yaml 脱敏, .env.sample 创建, 提交到 git |
| 16. README.md | ✅ 完成 | 2026-06-05 17:55 | 本文件 |

### 错误记录

#### 错误 1: GoTrue auth.email() 所有权 (2026-06-05 17:20)

**现象**: supabase-auth 容器启动后反复崩溃, 日志报 `ERROR: must be owner of function email (SQLSTATE 42501)`

**原因**: GoTrue (supabase_auth_admin) 执行迁移时需要 `CREATE OR REPLACE FUNCTION auth.email()`, 但该函数由 postgres 超级用户创建并拥有, supabase_auth_admin 无权修改。

**修复**: 在 `config/volumes/db/init/schema.sql` 中添加:
```sql
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
```

#### 错误 2: PostgREST schema graphql_public 不存在 (2026-06-05 17:35)

**现象**: supabase-rest 容器日志报 `schema "graphql_public" does not exist`, REST API 返回 503

**原因**: supabase/postgres 在 ARM64 上未加载 pg_graphql 扩展, 因此 `graphql_public` schema 不存在。Readest 只需 `public` schema。

**修复**: 在 `.env` 中将 `PGRST_DB_SCHEMAS=public,graphql_public` 改为 `PGRST_DB_SCHEMAS=public`

### 最终服务验证结果

| 端点 | HTTP 状态 | 说明 |
|------|-----------|------|
| `http://<HOST_IP>:8000/auth/v1/health` | 200 | Auth 健康检查通过 |
| `http://<HOST_IP>:8000/auth/v1/settings` (带 apikey) | 200 | Auth 设置正常返回 |
| `http://<HOST_IP>:8000/rest/v1/` (带 apikey+Bearer) | 200 | REST API 正常 |
| `http://<HOST_IP>:8000/api/` | 308 | 客户端重定向正常 |
| `http://<HOST_IP>:9001/` | 200 | MinIO 控制台可达 |
| `http://<HOST_IP>:9002/` | 403 | Nginx S3 代理运行中(需鉴权) |
