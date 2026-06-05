## Readest oec-4-fnOS 自建服务器部署

本目录包含在 **oec-4-fnOS (RK3566 OECT-4, ARM64, Debian 12)** 主机上部署 Readest 自建服务器容器集群的完整配置、脚本和文档。

### 目录结构

```
oec-4-fnOS-deploy/
├── config/                          # 部署配置文件 (上传到远程主机)
│   ├── compose.yaml                 # Docker Compose 编排文件 (已脱敏)
│   ├── .env.sample                  # 环境变量模板 (不含真实密钥)
│   ├── nginx-s3-proxy.conf          # Nginx S3 CORS 代理配置
│   └── volumes/
│       ├── api/
│       │   └── kong.yml             # Kong API 网关声明式配置
│       └── db/
│           ├── roles.sql            # Supabase 数据库角色初始化
│           ├── jwt.sql              # JWT 配置
│           ├── init/
│           │   └── schema.sql       # Readest 数据表 + auth 函数所有权
│           └── migrations/          # 13 个数据库迁移脚本 (001-013)
├── docs/
│   ├── deployment-plan.md           # 部署计划 (4阶段, 14步)
│   ├── progress.md                  # 部署进度跟踪 + 错误记录
│   └── desensitize-report.json      # compose.yaml 脱敏报告
├── scripts/
│   └── scp_upload.py                # SCP 上传脚本 (paramiko + SFTP)
└── README.md                        # 本文件
```

### 服务架构

8 个 Docker 容器组成的集群:

| 服务 | 镜像 | 对外端口 | 用途 |
|------|------|----------|------|
| db | supabase/postgres:15.8.1.085 | 无(内部5432) | PostgreSQL 数据库 |
| kong | kong:2.8.1 | 8000 | API 网关统一入口 |
| auth | supabase/gotrue:v2.185.0 | 无(内部9999) | 用户认证 (GoTrue) |
| rest | postgrest/postgrest:v14.3 | 无(内部3000) | 数据库 REST API |
| minio | minio/minio | 9000, 9001 | S3 对象存储 + 控制台 |
| minio-setup | minio/mc | 无(一次性) | 创建 S3 bucket |
| nginx-s3-proxy | nginx:alpine | 9002 | MinIO CORS 代理 |
| client | ghcr.io/readest/readest:latest | 无(内部3000) | Readest Web 前端 |

### 快速开始

**1. 准备 .env 文件**

```bash
cp config/.env.sample config/.env
# 编辑 config/.env, 填入真实的密码、JWT 密钥等
```

需要生成的密钥:
- `POSTGRES_PASSWORD`: 强密码 (建议 64 位 hex)
- `JWT_SECRET`: JWT 签名密钥 (建议 128 位 hex)
- `ANON_KEY` / `SERVICE_ROLE_KEY`: 用 JWT_SECRET 签名的 JWT token
- `MINIO_ROOT_PASSWORD`: MinIO 管理员密码

**2. 上传配置到远程主机**

准备 `password.csv` 文件 (不要提交到 git):
```csv
IP地址,用户名,密码,SSH端口
192.168.123.54,root,你的密码,22
```

执行上传:
```bash
python scripts/scp_upload.py --csv /path/to/password.csv
```

**3. 启动容器**

在远程主机上:
```bash
cd /vol1/docker/mycontainers/readest
docker compose up -d
```

**4. 验证服务**

```bash
# Auth 健康检查
curl http://<HOST_IP>:8000/auth/v1/health

# REST API (需要 apikey 和 Bearer token)
curl http://<HOST_IP>:8000/rest/v1/ \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"

# MinIO 控制台
# 浏览器访问 http://<HOST_IP>:9001
```

### 关键配置说明

- **HOST_IP**: 客户端访问服务器的 IP 地址 (Tailscale IP 或局域网 IP)
- **S3 双端点**: 内部服务间通信走 `http://minio:9000`, 外部客户端走 `http://<HOST_IP>:9002` (Nginx CORS 代理)
- **Kong 统一网关**: 所有 API 请求通过 Kong (端口 8000) 路由, `/auth/v1/*` 到 GoTrue, `/rest/v1/*` 到 PostgREST, `/api/*` 到 Readest Client
- **数据持久化**: 使用 bind mounts 映射到 `./data/db` 和 `./data/minio`, 而非 Docker named volumes

### ARM64 适配要点

- 使用 `supabase/postgres:15.8.1.085` (已确认支持 arm64), 避免手动创建 auth schema
- `PGRST_DB_SCHEMAS=public` (ARM64 上无 pg_graphql 扩展, 不存在 graphql_public schema)
- `schema.sql` 中增加 `ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin` 解决 GoTrue 迁移权限问题

### 相关文档

- [部署计划](docs/deployment-plan.md) - 4 阶段 14 步部署流程
- [进度跟踪](docs/progress.md) - 实际部署进度和错误记录
- [脱敏报告](docs/desensitize-report.json) - compose.yaml 脱敏变更详情
- [Readest Docker 部署指南](../self-hosted/Readest-Docker服务端部署指南.md) - 通用部署参考
