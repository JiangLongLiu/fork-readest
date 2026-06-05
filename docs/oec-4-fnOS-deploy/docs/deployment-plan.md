## Readest oec-4-fnOS 部署计划

### 目标
在 oec-4-fnOS (RK3566 OECT-4) 主机上部署 Readest 自建服务器容器集群。

### 目标主机
- IP: 192.168.123.54 (局域网), 服务访问IP: 100.110.75.2 (Tailscale)
- OS: fnOS (Debian 12, Linux ARM64)
- 工作目录: /vol1/docker/mycontainers/readest

### 服务架构 (8个容器)

| 服务 | 镜像 | 对外端口 | 用途 |
|------|------|----------|------|
| db | supabase/postgres:15.8.1.085 | 无(内部5432) | PostgreSQL 数据库 |
| kong | kong:2.8.1 | 8000 | API 网关统一入口 |
| auth | supabase/gotrue:v2.185.0 | 无(内部9999) | 用户认证 |
| rest | postgrest/postgrest:v14.3 | 无(内部3000) | 数据库 REST API |
| minio | minio/minio | 9000, 9001 | S3 对象存储 |
| minio-setup | minio/mc | 无(一次性) | 创建 S3 bucket |
| nginx-s3-proxy | nginx:alpine | 9002 | MinIO CORS 代理 |
| client | ghcr.io/readest/readest:latest | 无(内部3000) | Readest 前端 |

### 关键配置变更 (相比原始 self-hosted 部署)
1. HOST_IP 改为 100.110.75.2 (Tailscale IP)
2. 数据库使用 supabase/postgres:15.8.1.085 (已确认支持 arm64, 避免手动创建 auth schema)
3. 数据卷从 Docker named volumes 改为 bind mounts (映射到工作目录下 ./data/db, ./data/minio)
4. PGRST_DB_SCHEMAS 改为仅 public (ARM64 上无 graphql_public schema)
5. schema.sql 增加 auth.email() 函数所有权转移给 supabase_auth_admin

### 执行步骤

**阶段1: 准备**
1. 创建目录结构和本地工作区 ✅
2. 从 self-hosted-deploy 创建 oec-4-fnOS-deploy 分支 ✅
3. 远程端口占用检测 ✅

**阶段2: 配置**
4. 确认 supabase/postgres 镜像 ARM64 兼容性 ✅
5. 编写 compose.yaml (bind mounts, healthcheck) ✅
6. 编写 .env 配置文件 ✅
7. 复制 Kong / Nginx / SQL 配置 ✅

**阶段3: 部署**
8. SCP 上传所有配置到远程主机 ✅
9. 配置 Docker daemon 代理 (192.168.123.222:7890) ✅
10. 拉取镜像 ✅
11. 启动容器集群 ✅ (修复 auth.email() 和 graphql_public 问题后)
12. 验证服务状态和 API 可达性 ✅

**阶段4: 收尾**
13. 脱敏 compose.yaml 并提交到 git ✅
14. 编写 README.md 串联所有文档 ✅
