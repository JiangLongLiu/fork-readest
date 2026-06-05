## Readest 自建服务器 Android APK 编译指南

本文档记录了为 Readest 自建服务器场景编译 Android APK 的完整实战经验。不仅包含操作步骤，还固化了编译过程中的问题诊断思路和解决方案，适用于需要将 Readest Android 客户端连接到自建后端（而非官方 Supabase 云端）的部署场景。

---

### 一、理解 Tauri Android 构建管线

在动手之前，理解 Tauri 的构建管线至关重要。Android APK 不像传统 Android 应用那样简单打包——它的前端 UI 和服务器配置最终被嵌入到了 Rust 编译产物（`.so` 动态库）中。理解这一层关系，能避免后续绝大多数"改了配置但不生效"的问题。

整个构建分为三个阶段：

```
┌──────────────────┐    ┌──────────────────────┐    ┌───────────────────┐
│  Next.js 前端构建  │ →  │  Rust/cargo 编译      │ →  │  Gradle 打包 APK   │
│                  │    │                      │    │                   │
│ pnpm build       │    │ cargo build          │    │ gradlew assemble  │
│ (.env.tauri 注入) │    │ (tauri-build 嵌入前端) │    │ (.so + Android壳) │
│ 输出: out/ 目录   │    │ 输出: libreadestlib.so│    │ 输出: .apk 文件    │
└──────────────────┘    └──────────────────────┘    └───────────────────┘
```

**阶段 1 — Next.js 前端构建**：`pnpm build`（实际命令是 `dotenv -e .env.tauri -- next build`）读取 `.env.tauri` 中的环境变量，编译前端并生成静态导出到 `out/` 目录。所有以 `NEXT_PUBLIC_` 开头的变量会在这一步被静态嵌入 JavaScript 代码中。

**阶段 2 — Rust 编译**：`cargo build --release --target aarch64-linux-android` 编译 Rust 后端。在这个过程中，`tauri-build::build()`（在 `build.rs` 中调用）会读取 `tauri.conf.json` 的 `frontendDist` 配置（值为 `"../out"`），将 `out/` 目录中的所有前端资源处理成 codegen 资产（经过编码和压缩），存放在 `target/<triple>/release/build/Readest-*/out/tauri-codegen-assets/` 中，然后通过 `include_dir!` 宏嵌入到最终的 `.so` 动态库中。

**阶段 3 — Gradle 打包**：将编译好的 `.so` 放入 Android 项目的 `jniLibs/` 目录，和 Android 原生代码一起打包为 APK，并根据 `build.gradle.kts` 中的配置生成签名 APK。

**关键认知**：修改 `.env.tauri` 后，必须完整重走阶段 1 → 2 → 3。仅重跑阶段 3（Gradle 打包）不会更新 `.so` 中嵌入的前端资源，APK 仍然使用旧的服务器地址。

---

### 二、前置环境要求

编译 Android APK 需要以下工具链，请在开始前确认全部就绪：

- **Rust 工具链**：通过 rustup 安装，并添加 Android 目标架构：
  ```bash
  rustup target add aarch64-linux-android
  ```
- **Android SDK**：包含 `build-tools`（建议 35.0+ 或 36.1）、`platforms`（需 `android-36`）
- **Android NDK**：版本 23.1.7779620 已验证可用，位于 `Sdk/ndk/23.1.7779620/`
- **JDK**：Gradle 8.14.3 要求 JDK 17+。JDK 11 **不可用**（会导致 Gradle 启动失败）。已验证 JDK 22 可用
- **Node.js + pnpm**：用于 Next.js 前端构建
- **Tauri CLI**：项目内 `node_modules/.bin/tauri`（通过 `npx tauri` 调用）

---

### 三、构建配置

#### 3.1 工具链路径环境变量

构建时需要设置三个环境变量，指向本地的 SDK/NDK/JDK（Windows 环境）：

```bash
set ANDROID_HOME=D:\Android\Sdk
set ANDROID_NDK_HOME=D:\Android\Sdk\ndk\23.1.7779620
set JAVA_HOME=C:\Java\jdk-22.0.1
```

或在 Git Bash / MSYS2 中：

```bash
export ANDROID_HOME="D:/Android/Sdk"
export ANDROID_NDK_HOME="D:/Android/Sdk/ndk/23.1.7779620"
export JAVA_HOME="C:/Java/jdk-22.0.1"
```

请根据实际安装路径调整。

#### 3.2 自建服务器配置（`.env.tauri`）

位于 `apps/readest-app/.env.tauri`，这个文件决定了 APK 内置的服务器地址。自建服务器场景下的关键配置：

```env
NEXT_PUBLIC_APP_PLATFORM=tauri

# 自建服务器地址
NEXT_PUBLIC_SUPABASE_URL=http://<服务器IP>:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<你的 anon JWT>
SUPABASE_ADMIN_KEY=<你的 service_role JWT>

NEXT_PUBLIC_API_BASE_URL=http://<服务器IP>:3000
NEXT_PUBLIC_STORAGE_FIXED_QUOTA=1073741824
NEXT_PUBLIC_TRANSLATION_FIXED_QUOTA=50000

# S3 存储（MinIO）
NEXT_PUBLIC_OBJECT_STORAGE_TYPE=s3
S3_ENDPOINT=http://<服务器IP>:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=<你的 MinIO 密码>
S3_BUCKET_NAME=readest-files
S3_REGION=us-east-1
```

**核心原则**：所有 `NEXT_PUBLIC_` 前缀变量在 Next.js 构建时（阶段 1）被静态嵌入 JavaScript。APK 编译完成后这些地址**无法更改**，修改必须重编译。

#### 3.3 Android 端 HTTP 明文流量配置

文件 `src-tauri/gen/android/app/build.gradle.kts` 中的 `usesCleartextTraffic` 控制是否允许 HTTP 请求：

```kotlin
defaultConfig {
    manifestPlaceholders["usesCleartextTraffic"] = "true"  // 自建 HTTP 服务器必须为 true
    applicationId = "com.bilingify.readest"
    minSdk = 26
    targetSdk = 36
    // ...
}
```

**默认值是 `"false"`**。Android 9+ 默认禁止明文 HTTP 流量。自建服务器使用 `http://` 协议时，此值必须改为 `"true"`，否则所有 HTTP 请求会被 Android 系统直接拦截。

#### 3.4 APK 签名配置

在 `src-tauri/gen/android/` 下创建 `keystore.properties` 文件：

```properties
keyAlias=<你的密钥别名>
password=<你的密钥密码>
storeFile=<密钥库文件的绝对路径，用正斜杠>
```

这个文件被 `build.gradle.kts` 中的 `signingConfigs` 读取。如果文件不存在，APK 不会被签名（文件名会包含 `unsigned`）。

---

### 四、完整编译流程（已验证可用）

以下是在 Windows 环境下从清除缓存到产出签名 APK 的完整步骤：

#### 步骤 1：清除 Rust 构建缓存

这一步确保 `tauri-build` 重新处理前端资源，而不是复用旧的 codegen 资产：

```bash
cd <项目根目录>/readest-deploy

# 删除 Readest 的 tauri-build codegen 缓存
rm -rf target/aarch64-linux-android/release/build/Readest-*

# 删除旧的 .so 编译产物
rm -f target/aarch64-linux-android/release/libreadestlib.so
rm -f target/aarch64-linux-android/release/deps/libreadestlib*
```

**为什么必须清缓存**：`tauri-build` 会在 `target/<triple>/release/build/Readest-*/out/tauri-codegen-assets/` 中缓存前端资源。如果不清除，即使 `out/` 目录已更新，Rust 编译器可能仍然使用旧的缓存资产。我们实际遇到过：缓存目录有 693 个文件，清除后重新生成只有 524 个——旧缓存中混入了不属于当前版本的资源。

#### 步骤 2：运行 Tauri Android 构建

```bash
cd apps/readest-app
npx tauri android build -t aarch64
```

此命令会依次触发三个阶段：

1. `pnpm build` → Next.js 静态导出（使用 `.env.tauri` 注入环境变量）
2. `cargo build --release --target aarch64-linux-android` → Rust 编译 + 前端嵌入
3. Gradle 打包 → 在 Windows 上会在 symlink 步骤失败（**这是正常的，见下一步**）

#### 步骤 3：手动复制 .so 文件（Windows symlink 绕过）

Tauri CLI 使用符号链接将 `.so` 放入 Android 项目的 `jniLibs/`，但 Windows 默认禁止创建 symlink。手动复制即可：

```bash
cp ../../target/aarch64-linux-android/release/libreadestlib.so \
   src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libreadestlib.so
```

如果 Windows 开启了"开发者模式"（Settings > System > For developers > Developer Mode），则可以跳过此步骤，Tauri 的 symlink 操作会自动成功。

#### 步骤 4：Gradle 单独打包签名 APK

```bash
cd src-tauri/gen/android
./gradlew app:assembleArm64Release -x :app:rustBuildArm64Release --no-daemon
```

`-x :app:rustBuildArm64Release` 告诉 Gradle 跳过 Rust 编译任务——因为我们已经在上一步手动复制了编译好的 `.so`。

#### 步骤 5：获取 APK

输出位置：

```
app/build/outputs/apk/arm64/release/Readest-arm64-yyyyMMdd-HHmmss.apk
```

APK 文件名自动包含构建时间戳（如 `Readest-arm64-20260605-143022.apk`），方便区分多次构建。这是通过 `build.gradle.kts` 中的 `applicationVariants` 配置实现的。

如果配置了 `keystore.properties`，APK 已自动签名。

---

### 五、问题诊断方法论

在编译和测试过程中，我们总结了一套分层诊断方法，用于快速定位问题所在层级。

#### 5.1 诊断框架：从服务端往回查

当 Android 端出现异常时，**不要从客户端开始排查**，而应该从服务端往回查：

**第一层 — 服务端是否收到请求？**

检查 Docker 日志，确认请求是否到达服务器：

```bash
# 检查 Kong（API 网关）日志
docker logs readest-kong-1 --tail 50

# 检查 GoTrue（认证服务）日志
docker logs readest-auth-1 --tail 50

# 检查 REST API 日志
docker logs readest-rest-1 --tail 50
```

如果服务端完全没有来自 Android 设备的请求记录，说明问题在客户端到服务端之间——要么是 Android 系统拦截了请求（`usesCleartextTraffic`），要么是客户端配置了错误的地址（`.env.tauri`）。

**第二层 — API 本身是否正常？**

用 curl 直接测试 API，排除客户端干扰：

```bash
# 测试登录
curl -X POST "http://<服务器IP>:8000/auth/v1/token?grant_type=password" \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"your_password"}'

# 测试同步拉取
curl "http://<服务器IP>:3000/api/sync" \
  -H "Authorization: Bearer <access_token>"

# 测试同步推送
curl -X POST "http://<服务器IP>:3000/api/sync" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"books":[]}'
```

如果 curl 能正常工作但 Android 端不行，问题一定在 Android 客户端层面。

**第三层 — Android 客户端配置是否正确？**

用 `aapt2` 检查 APK 中的关键配置：

```bash
# 检查 usesCleartextTraffic
aapt2 dump xmltree --file AndroidManifest.xml <apk文件> | grep cleartext

# 检查签名
apksigner verify --print-certs <apk文件>
```

用 `strings` 检查 `.so` 中是否嵌入了前端资源：

```bash
# 检查 .so 是否包含前端资源
strings libreadestlib.so | grep "_next/static"

# 注意：tauri-codegen-assets 使用二进制编码，无法用 strings 直接查找明文 URL
# 因此应该检查 Next.js 构建输出而非 .so 中的 URL 字符串
```

**第四层 — 前端资源是否包含正确 URL？**

```bash
# 在 Next.js 构建输出中搜索服务器地址
grep -r "<服务器IP>" apps/readest-app/out/

# 检查环境变量是否正确注入
grep -r "SUPABASE_URL" apps/readest-app/out/ | head -5
```

#### 5.2 关键诊断工具清单

| 工具 | 用途 | 检查对象 |
|------|------|----------|
| `docker logs` | 查看请求是否到达服务端 | Kong / GoTrue / REST |
| `curl` | 直接测试 API，排除客户端 | 所有 HTTP API |
| `aapt2 dump xmltree` | 检查 APK 的 AndroidManifest 配置 | usesCleartextTraffic |
| `apksigner verify` | 验证 APK 签名 | APK 文件 |
| `strings` + `grep` | 检查 .so 是否包含前端资源 | libreadestlib.so |
| `grep -r` | 检查前端 JS 是否包含正确 URL | out/ 目录 |

---

### 六、踩坑记录与解决方案

#### 坑 1：usesCleartextTraffic 默认拦截 HTTP

**现象**：Android 端登录报 "Invalid login credentials"，但同一账号在 Windows 桌面端和 Web 端都能正常登录。服务端日志中完全看不到来自 Android 设备的任何请求。

**诊断过程**：服务端日志无记录 → 请求没到服务器 → 客户端到服务器之间有阻断 → 检查 AndroidManifest 发现 usesCleartextTraffic=false。

**根因**：`build.gradle.kts` 的默认值为 `"false"`，Android 9+ 系统直接拦截所有 HTTP 请求。应用层无法区分"请求被系统拦截"和"密码错误"，统一显示 "Invalid login credentials"——这个错误信息极具误导性。

**解决**：将 `manifestPlaceholders["usesCleartextTraffic"]` 改为 `"true"`。

**验证方法**：检查服务端日志，如果看不到来自 Android 设备的请求，首先怀疑 HTTP 流量被系统拦截。

#### 坑 2：只改 Gradle 配置不重编 Rust = 白搭

**现象**：修改了 `usesCleartextTraffic` 后用 Gradle 重新打包 APK（跳过了 Rust 编译），安装后登录仍然报 "Invalid login credentials"。

**诊断过程**：用 `strings` 检查新的 `.so` 文件 → 搜索服务器 IP 地址 → 找到 0 个匹配 → `.so` 中没有嵌入自建服务器 URL → 确认 Rust 没有重新编译。

**根因**：APK 的前端 UI 和服务器配置嵌入在 `.so` 中。只运行 Gradle 打包（阶段 3）而跳过 Rust 编译（阶段 2），`.so` 中的前端资源仍然是旧的。

**教训**：修改 `.env.tauri` 后必须从阶段 1 开始完整重走。修改 `build.gradle.kts`（如 usesCleartextTraffic）只需重走阶段 3。分清配置的修改影响哪个阶段。

#### 坑 3：Rust 构建缓存导致旧资源被复用

**现象**：即使重新运行了 `tauri android build`，产出的 `.so` 仍然嵌入旧的前端资源。

**诊断过程**：检查 `out/` 目录确认前端 JS 已包含新 URL → 但 `strings libreadestlib.so` 找不到对应内容 → 检查 codegen 缓存目录发现文件数量和旧版一致 → 清除缓存后重新编译恢复正常。

**根因**：`tauri-build` 会缓存 codegen 资产在 `target/<triple>/release/build/Readest-*/out/tauri-codegen-assets/`。在某些情况下（特别是前端变更但 Rust 代码未变时），Rust 编译器认为 `build.rs` 的输入没变，直接使用缓存而不重新处理。

**解决**：编译前手动删除缓存目录（见步骤 1）。

**额外注意**：codegen 资产使用二进制编码（非明文），文件名是哈希值，内容经过压缩。因此无法用 `strings` 在 codegen 目录中搜索 URL 文本来验证前端是否正确嵌入——只能检查 Next.js 的 `out/` 输出和最终 `.so` 中的 `_next/static` 路径标记。

#### 坑 4：Windows 不允许创建符号链接

**现象**：`tauri android build` 在 Rust 编译成功后报错：
```
Failed to create a symbolic link ...
Creation symbolic link is not allowed for this system.
```

**根因**：Windows 默认禁止非管理员用户创建符号链接。Tauri CLI 使用 symlink 将编译好的 `.so` 链接到 Android 项目的 `jniLibs/` 目录。

**解决方案**：手动复制 `.so` 文件后直接用 Gradle 打包（见第四节步骤 3-4）。如需根本解决，在 Windows 设置中开启"开发者模式"。

---

### 七、配置修改影响范围速查

不同的配置修改需要重走不同的编译阶段，以下是速查表：

| 修改内容 | 影响阶段 | 需要重做 |
|----------|----------|----------|
| `.env.tauri`（服务器地址、密钥等） | 阶段 1+2+3 | 清缓存 → 完整重编 |
| `build.gradle.kts`（usesCleartextTraffic、签名等） | 仅阶段 3 | Gradle 重新打包即可 |
| `AndroidManifest.xml`（权限、deep link 等） | 仅阶段 3 | Gradle 重新打包即可 |
| `tauri.conf.json`（frontendDist、SDK 版本等） | 阶段 2+3 | 清缓存 → Rust 重编 + Gradle |
| 前端代码（React 组件、样式等） | 阶段 1+2+3 | 清缓存 → 完整重编 |
| Rust 代码（Tauri 命令、插件等） | 阶段 2+3 | Rust 重编 + Gradle |

---

### 八、验证清单

编译完成后，建议逐项验证：

1. **APK 签名**：`apksigner verify --print-certs <apk文件>` — 确认签名有效
2. **usesCleartextTraffic**：`aapt2 dump xmltree --file AndroidManifest.xml <apk文件> | grep cleartext` — 确认值为 `true`
3. **前端 JS 包含正确 URL**：`grep -r "<服务器IP>" apps/readest-app/out/` — 确认 `out/` 中的 JS 文件包含自建服务器地址
4. **`.so` 库包含前端资源**：`strings libreadestlib.so | grep "_next/static"` — 应能找到大量匹配，确认前端被嵌入
5. **服务端可达性**：用 curl 测试登录 API，确认服务器正常运行
6. **设备端测试**：安装 APK 后在浏览器中访问 `http://<服务器IP>:3000`，确认设备能访问服务器

---

### 九、完整构建速查脚本

以下是可以直接使用的完整构建脚本（Windows Git Bash 环境）：

```bash
#!/bin/bash
# ============================================================
# Readest Android APK 构建脚本（自建服务器版）
# 环境：Windows + Git Bash
# ============================================================

# --- 配置区 ---
ANDROID_HOME="D:/Android/Sdk"
ANDROID_NDK_HOME="D:/Android/Sdk/ndk/23.1.7779620"
JAVA_HOME="C:/Java/jdk-22.0.1"
PROJECT_ROOT="/path/to/readest-deploy"

export ANDROID_HOME ANDROID_NDK_HOME JAVA_HOME

# --- 步骤 1：清除 Rust 构建缓存 ---
echo ">>> 清除构建缓存..."
cd "$PROJECT_ROOT"
rm -rf target/aarch64-linux-android/release/build/Readest-*
rm -f  target/aarch64-linux-android/release/libreadestlib.so
rm -f  target/aarch64-linux-android/release/deps/libreadestlib*

# --- 步骤 2：Tauri Android 构建（前端编译 + Rust 编译） ---
echo ">>> 运行 Tauri Android 构建..."
cd "$PROJECT_ROOT/apps/readest-app"
npx tauri android build -t aarch64
# 预期：Rust 编译成功，Gradle 打包阶段因 symlink 失败（正常）

# --- 步骤 3：手动复制 .so ---
echo ">>> 复制 .so 文件..."
cp "$PROJECT_ROOT/target/aarch64-linux-android/release/libreadestlib.so" \
   "$PROJECT_ROOT/apps/readest-app/src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libreadestlib.so"

# --- 步骤 4：Gradle 打包签名 APK ---
echo ">>> Gradle 打包 APK..."
cd "$PROJECT_ROOT/apps/readest-app/src-tauri/gen/android"
./gradlew app:assembleArm64Release -x :app:rustBuildArm64Release --no-daemon

# --- 步骤 5：输出结果 ---
APK_DIR="$PROJECT_ROOT/apps/readest-app/src-tauri/gen/android/app/build/outputs/apk/arm64/release"
APK_PATH=$(ls -t "$APK_DIR"/Readest-arm64-*.apk 2>/dev/null | head -1)
echo ""
echo ">>> 构建完成！"
if [ -n "$APK_PATH" ]; then
    echo ">>> APK 位置: $APK_PATH"
    echo ">>> 文件大小: $(du -h "$APK_PATH" | cut -f1)"
else
    echo ">>> [FAIL] 未找到 APK 文件，请检查上方错误信息"
fi
echo ""

# --- 步骤 6：基本验证 ---
echo ">>> 验证 APK..."
if [ -n "$APK_PATH" ] && [ -f "$APK_PATH" ]; then
    echo "  [OK] APK 文件存在"
    echo "  文件大小: $(du -h "$APK_PATH" | cut -f1)"
else
    echo "  [FAIL] APK 文件不存在，请检查上方错误信息"
fi
```

---

### 十、服务端 API 快速验证

在测试 Android 端之前，先用以下 curl 命令确认服务端 API 工作正常：

```bash
#!/bin/bash
# 服务端 API 验证脚本
SERVER="http://<服务器IP>"
ANON_KEY="<你的 anon JWT>"

echo "=== 1. 测试登录 ==="
curl -s -X POST "$SERVER:8000/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"your_password"}' | jq .

echo ""
echo "=== 2. 测试同步拉取 ==="
# 用上一步返回的 access_token
TOKEN="<access_token>"
curl -s "$SERVER:3000/api/sync" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 3. 测试文件上传（presigned URL）==="
# 先获取 presigned URL，再上传
curl -s -X POST "$SERVER:3000/api/files/upload-url" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.epub","contentType":"application/epub+zip"}' | jq .
```

如果以上 API 都能正常响应，说明服务端没有问题，Android 端的故障一定在客户端配置层面。
