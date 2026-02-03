# GLKB Backend 开发者指南

## 项目概览

GLKB（Graph-based Literature Knowledge Base）后端服务，基于 **FastAPI** 构建，用于管理生物医学文献知识图谱。

**技术栈：**
- **Web 框架**：FastAPI + Uvicorn
- **图数据库**：Neo4j（存储知识图谱）
- **关系型数据库**：SQLite + SQLAlchemy（存储用户信息）
- **向量检索**：FAISS + OpenAI Embeddings
- **监控**：Prometheus

---

## 目录结构

```
app/
├── main.py                  # 应用入口，FastAPI 实例创建、CORS、中间件、生命周期管理
├── api/                     # API 路由层
│   ├── deps.py              # 依赖注入（JWT 鉴权、获取当前用户等）
│   └── v1/
│       ├── router.py        # 路由聚合，把各模块路由挂到 /api/v1 下
│       ├── auth.py          # ⚠️ 废弃：账号密码登录（见下方说明）
│       ├── email_auth.py    # ✅ 当前使用的登录系统（邮箱验证码 + Google 登录）
│       ├── graph.py         # 图可视化相关接口（需登录）
│       ├── search.py        # 搜索接口（需登录）
│       └── agent.py         # AI Agent 接口（已注释掉，未启用）
│
├── core/                    # 核心基础设施
│   ├── config.py            # 配置管理（Pydantic Settings，读取 .env）
│   ├── database.py          # Neo4j 异步数据库连接管理
│   ├── middleware.py        # HTTP 中间件（日志、Prometheus 指标）
│   └── vector_stores.py     # 向量存储（FAISS、OpenAI Embeddings）
│
├── db/                      # SQLAlchemy ORM 层
│   ├── database.py          # SQLAlchemy engine、session、Base
│   └── models.py            # 数据模型（User, EmailAuthUser, VerificationCode, RateLimit）
│
├── schemas/                 # Pydantic 请求/响应模型
│   ├── auth.py              # 废弃的账号密码登录相关 schema
│   ├── email_auth.py        # 邮箱验证登录相关 schema
│   ├── graph.py             # 图操作 schema
│   ├── search.py            # 搜索 schema
│   └── agent.py             # Agent schema
│
├── services/                # 业务逻辑层
│   ├── auth_service.py      # 废弃的账号密码认证逻辑
│   ├── email_auth_service.py # ✅ 当前认证逻辑（发送验证码、校验、Cognito 登录等）
│   ├── graph_service.py     # 图操作（生成图、合并边、Cytoscape 格式转换）
│   ├── search_service.py    # 搜索（实体搜索、文章搜索、语义搜索）
│   └── agent_service.py     # AI Agent 逻辑（MCP 相关，未完全启用）
│
├── utils/                   # 工具函数
│   ├── security.py          # JWT Token 创建和解析
│   ├── email.py             # SMTP 邮件发送（发送验证码邮件）
│   ├── cognito.py           # AWS Cognito JWT 验证（Google 登录用）
│   └── helpers.py           # 通用辅助函数
│
└── resources/
    └── cypher.json          # Neo4j Cypher 查询模板

scripts/                     # 各种测试/工具脚本
nlp/                         # NLP/Agent 模块（大部分为空）
users.db                     # SQLite 数据库文件
```

---

## 登录系统（重点）

### 当前使用的系统：邮箱验证码 + Google 登录

路由前缀：`/api/v1/email-auth/`

涉及文件：
- `app/api/v1/email_auth.py` — API 端点
- `app/services/email_auth_service.py` — 核心业务逻辑
- `app/schemas/email_auth.py` — 请求/响应模型
- `app/db/models.py` — `EmailAuthUser`、`VerificationCode`、`RateLimit` 表
- `app/utils/email.py` — SMTP 邮件发送
- `app/utils/cognito.py` — AWS Cognito Token 验证

#### 登录方式一：邮箱验证码

1. 前端调用 `POST /api/v1/email-auth/send-code`，传入邮箱
2. 后端自动注册新用户（如果邮箱不存在），生成 6 位验证码，SHA-256 哈希后存入数据库，通过 SMTP 发送邮件
3. 前端调用 `POST /api/v1/email-auth/verify`，传入邮箱和验证码
4. 验证通过后返回 JWT Token（有效期 24 小时）

安全机制：
- 验证码 10 分钟过期
- 每个验证码最多尝试 5 次
- 每个邮箱每小时限发 5 次
- 每个 IP 每小时限发 10 次

#### 登录方式二：Google 登录（AWS Cognito）

1. 前端走 Google OAuth → 获得 Cognito ID Token
2. 前端调用 `POST /api/v1/email-auth/cognito`，传入 Cognito Token
3. 后端用 Cognito 公钥（JWKS）验证 Token，提取邮箱
4. 自动注册或登录，返回后端 JWT Token

#### 端点一览

| 端点 | 方法 | 说明 | 需要登录 |
|---|---|---|---|
| `/email-auth/send-code` | POST | 发送验证码 | 否 |
| `/email-auth/verify` | POST | 验证码登录 | 否 |
| `/email-auth/cognito` | POST | Google 登录 | 否 |
| `/email-auth/register` | POST | 手动注册 | 否 |
| `/email-auth/username` | PUT | 修改用户名 | 是 |
| `/email-auth/email/request-change` | POST | 请求换绑邮箱 | 是 |
| `/email-auth/email/confirm-change` | POST | 确认换绑邮箱 | 是 |

#### JWT Token 格式

邮箱登录系统生成的 Token payload：
```json
{"sub": "user_id", "type": "email_auth", "email": "user@example.com"}
```

鉴权中间件（`app/api/deps.py`）通过 `type` 字段判断查哪张用户表：
- `type == "email_auth"` → 查 `email_auth_users` 表
- 否则 → 查 `users` 表（废弃的密码登录系统）

---

### ⚠️ 废弃方案：账号密码登录

**这套系统是早期方案，已经不再使用，但代码仍保留在项目中。** 路由目前仍挂载在 `/api/v1/auth/`（见 `router.py`），如果确认不需要可以移除。

涉及文件：
- `app/api/v1/auth.py` — 注册/登录/登出端点
- `app/services/auth_service.py` — bcrypt 密码哈希、JWT 签发
- `app/schemas/auth.py` — 请求/响应模型
- `app/db/models.py` 中的 `User` 类（对应 `users` 表）

这套系统使用传统的用户名+密码方式，密码用 bcrypt 加密存储。它和邮箱登录系统使用**不同的数据库表**（`users` vs `email_auth_users`），互不干扰。

---

## 业务模块

### 搜索 (`/api/v1/search/`)

需要登录。支持的搜索类型：
- **实体搜索**：按 ID 或名称搜索（支持 Gene、Chemical、Disease、MeSH、Variant 类型过滤）
- **词汇搜索**：文章标题全文检索
- **语义搜索**：基于 OpenAI Embeddings 或 FAISS 的向量相似度搜索

### 图操作 (`/api/v1/graphs/`)

需要登录。功能包括：
- 从三元组生成图结构
- 合并重复边
- 转换为 Cytoscape.js 格式（供前端可视化）
- 实体图与文章图的互转

---

## 配置

复制 `.env.example` 为 `.env`，填入以下配置：

- **Neo4j**：`NEO4J_URI`、`NEO4J_USER`、`NEO4J_PASSWORD`
- **JWT**：`JWT_SECRET_KEY`（生产环境务必修改）
- **SMTP**：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`（邮箱验证码需要）
- **AWS Cognito**：`COGNITO_REGION`、`COGNITO_USER_POOL_ID`、`COGNITO_APP_CLIENT_ID`（Google 登录需要）
- **OpenAI**：`OPENAI_API_KEY`（语义搜索需要）

## 启动

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档：`http://localhost:8000/docs`

---

## 部署

后端部署在服务器上，通过 Nginx 反向代理 + tmux 后台运行 uvicorn 的方式提供服务。

### Nginx

Nginx 作为反向代理，接收外部 HTTPS 请求，转发到本地的 uvicorn 服务（8001 端口）。大致逻辑：

```
用户请求 → Nginx (443/80) → 反向代理 → uvicorn (localhost:8001)
```

Nginx 配置文件位于：

```
/etc/nginx/glkb.d/
```

修改配置后需要重新加载 Nginx：

```bash
# 先检查配置语法是否正确
sudo nginx -t

# 重新加载（不中断现有连接）
sudo nginx -s reload
```

> **注意**：目前你的账号可能没有操作 Nginx 的权限（需要 sudo）。如果遇到权限问题，联系 Jonathan 让他给你加上 Nginx 的操作权限。

### 启动后端服务（tmux）

后端通过 tmux session 在后台运行，这样即使 SSH 断开服务也不会停止。

#### 常用操作

```bash
# 查看现有 tmux session
tmux ls

# 连接到已有的后端 session（假设 session 名为 backend，以实际为准）
tmux attach -t backend

# 进入 session 后你会看到 uvicorn 的日志输出
# 如果需要重启服务，先 Ctrl+C 停掉，然后重新启动：
uvicorn app.main:app --host 0.0.0.0 --port 8001

# 从 tmux session 中退出（不会停止服务）：按 Ctrl+B，然后按 D（detach）

# 如果 session 不存在，需要新建：
tmux new -s backend
# 然后在里面启动 uvicorn
```

#### tmux 快捷键速查

| 操作 | 快捷键 |
|---|---|
| 从 session 中 detach（退出但不停止） | `Ctrl+B` 然后 `D` |
| 向上滚动查看日志 | `Ctrl+B` 然后 `[`，用方向键滚动，按 `Q` 退出 |
| 列出所有 session | `tmux ls` |
