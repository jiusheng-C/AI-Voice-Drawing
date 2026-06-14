# AI 语音绘图工具

AI 语音绘图工具是一个面向浏览器的绘图工作台，目标是在正式创作流程中通过语音完成绘图、修改、撤销、模型切换和导出等操作。

当前 MVP 使用 Go + Gin 作为后端，MySQL 作为数据存储，React + TypeScript + Vite 构建前端，Fabric.js 负责画布渲染。外部 AI API 不可用时，系统会使用 mock provider 保证本地演示闭环。

首屏就是绘图工作台，不提供营销页或 landing page。

## 当前能力

- 绘图工作台：打开前端后直接进入画布优先的创作界面。
- 文本调试入口：用于开发和验收时稳定触发中文绘图指令，正式创作主路径仍以语音为准。
- 语音链路：前端采集语音并通过 WebSocket 连接后端，后端使用 mock ASR/NLU/TTS 返回可执行命令和反馈。
- Fabric.js 画布：支持创建圆形、矩形、文本，修改最近对象颜色，撤销、重做和导出 PNG。
- 模型中心：支持查看和选择 ASR、NLU/LLM、TTS 的 mock 模型模式。
- 后端 API：包含健康检查、项目 API、画布状态 API、模型中心 API、文本指令解析 API 和语音 WebSocket。
- 本地数据库：通过 Docker Compose 启动 MySQL，并使用 Go 迁移命令初始化表结构和 mock 数据。

## 项目结构

```text
backend/   Go 后端服务、HTTP API、数据库访问、迁移和 AIHub provider
frontend/  React + TypeScript + Vite 前端工作台和 Fabric.js 画布客户端
docs/      实现说明、API 契约和演示脚本
scripts/   本地检查与演示辅助脚本
```

## 环境要求

- Go 1.22 或更高版本
- Node.js 20 或更高版本
- Docker 与 Docker Compose
- MySQL 8.0，推荐直接使用本仓库的 Docker Compose 配置

## 本地启动

### 1. 启动 MySQL

```bash
docker compose up -d mysql
```

默认连接信息：

- 地址：`127.0.0.1:13306`
- 数据库：`voice_drawing`
- 默认应用 DSN：见 `.env.example`

如需修改宿主机端口，可设置 `MYSQL_PORT`。

### 2. 执行数据库迁移

```bash
cd backend
go run ./cmd/migrate
```

迁移会创建项目、画布、命令日志、模型中心等 MVP 所需数据表，并写入 mock 模型数据。

### 3. 启动后端

```bash
cd backend
go mod tidy
go run ./cmd/server
```

后端默认监听 `http://localhost:8080`。如果 `8080` 被占用，可设置 `HTTP_PORT`。

健康检查：

```bash
curl http://localhost:8080/healthz
```

项目 API 示例：

```bash
curl -X POST http://localhost:8080/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"语音绘图演示","description":"MVP 绘图项目"}'

curl http://localhost:8080/api/v1/projects
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认访问地址：`http://localhost:5173`。

## MVP 演示流程

1. 启动 MySQL：`docker compose up -d mysql`。
2. 执行迁移：`cd backend && go run ./cmd/migrate`。
3. 启动后端：`cd backend && go run ./cmd/server`。
4. 启动前端：`cd frontend && npm run dev`。
5. 打开 `http://localhost:5173`，首屏应直接进入绘图工作台。
6. 右侧“连接配置”默认启用“使用本地 mock 演示”。后端未启动或外部 AI API 不可用时，不需要额外配置即可完成演示。
7. 如需连接真实后端，在“连接配置”中关闭 mock，并确认后端 API 为 `http://localhost:8080`、语音 WebSocket 为 `ws://localhost:8080`。
8. 在开发调试文本框中依次输入：
   - `画一个蓝色圆形`
   - `画一个红色矩形`
   - `把它改成绿色`
   - `撤销`
9. 画布应依次出现蓝色圆形、红色矩形，最近对象变为绿色，撤销后回到上一步。
10. 点击“授权麦克风”触发浏览器权限弹窗，授权后按钮会变为“开始语音”。点击开始后说出指令，再点击“停止语音”执行识别结果；如果浏览器语音识别或后端不可用，会自动使用本地 mock 指令兜底。
11. 打开模型中心，可以查看并选择 ASR、NLU/LLM、TTS 模型模式；mock 模式下选择会保存到浏览器本地。
12. 使用画布工具栏的 PNG 导出当前画布。

常用中文指令示例：

- 创建：`画一个蓝色圆形`、`画一个红色矩形`、`画一个绿色椭圆`、`画一个黄色三角形`、`画一个蓝色菱形`、`画一个红色五角星`、`画一条黑色箭头`、`创建一个便签`、`创建一个流程节点`、`创建一个图片占位`、`写“开始处理”`
- 修改：`把它改成绿色`、`把边框改成红色`、`放大当前对象`、`缩小当前对象`、`旋转当前对象`
- 布局：`向右移动`、`置顶当前对象`、`置底当前对象`、`所有对象左对齐`、`所有对象水平居中`、`所有对象顶端对齐`、`所有对象水平等距分布`、`所有对象垂直等距分布`
- 对象：`选择圆形`、`复制当前对象`、`把所有对象分组`、`取消分组`、`删除当前对象`
- 画布与导出：`清空画布`、`撤销`、`重做`、`导出 PNG`

也可以运行本地演示检查脚本：

```powershell
./scripts/demo-check.ps1
```

## 常用检查命令

后端格式化与测试：

```bash
cd backend
go fmt ./...
go test ./...
```

前端依赖、静态检查与构建：

```bash
cd frontend
npm install
npm run lint
npm run build
```

数据库迁移验证：

```bash
cd backend
go run ./cmd/migrate
```

## 交付规则

本项目采用小粒度 GitHub PR 持续交付：

- 所有功能和文档变更都应从最新 `main` 创建独立分支。
- 每个 PR 只做一件事，并保持主分支在合并后可运行。
- PR 描述需要包含功能描述、实现思路、测试方式、影响范围和后续事项。
- 不把互不相关的模型中心、导出、UI 重构等改动混在同一个 PR。
- 不允许在项目末尾一次性提交或一次性合并大 PR。

## 说明

开发阶段保留文本指令调试入口，是为了自动化测试和无麦克风环境验证。正式创作主路径仍然是语音控制，外部 AI 服务不可用时使用 mock provider 保证本地闭环。
