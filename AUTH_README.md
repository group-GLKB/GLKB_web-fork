# Authentication API 认证接口文档

GLKB Backend 用户认证系统，提供注册、登录、登出功能。

---

## 📋 Endpoints 接口列表

### 1. 用户注册 `POST /api/v1/auth/signup`

**作用**: 创建新用户账号

**请求体**:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

**参数说明**:
- `username`: 用户名（3-50字符，唯一）
- `email`: 邮箱地址（唯一）
- `password`: 密码（最少8字符）

**成功响应** `201 Created`:
```json
{
  "message": "User 'testuser' created successfully"
}
```

**错误响应** `400 Bad Request`:
```json
{
  "detail": "Username already registered"
}
```
或
```json
{
  "detail": "Email already registered"
}
```

**调用示例**:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

### 2. 用户登录 `POST /api/v1/auth/login`

**作用**: 验证用户凭据，返回JWT访问令牌

**请求体**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**参数说明**:
- `username`: 用户名
- `password`: 密码

**成功响应** `200 OK`:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "is_active": true,
    "is_superuser": false,
    "created_at": "2024-12-22T19:00:00.000000",
    "updated_at": "2024-12-22T19:00:00.000000"
  }
}
```

**错误响应** `401 Unauthorized`:
```json
{
  "detail": "Incorrect username or password"
}
```

**错误响应** `403 Forbidden`:
```json
{
  "detail": "User account is disabled"
}
```

**调用示例**:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**使用返回的Token**:
```bash
# 在后续请求中使用token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET "http://localhost:8000/api/v1/some-protected-endpoint" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3. 用户登出 `POST /api/v1/auth/logout`

**作用**: 登出用户（客户端应删除存储的token）

**请求体**: 无

**成功响应** `200 OK`:
```json
{
  "message": "Logged out successfully"
}
```

**说明**:
- JWT是无状态的，服务器端不存储session
- 真正的登出由客户端删除存储的token完成
- 此接口仅返回确认消息

**调用示例**:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/logout"
```

---

