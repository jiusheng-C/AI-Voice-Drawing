# AI 语音绘图工具项目开发文档

版本：2026-06-12 优化版

## 0. 项目定位

项目名称：AI 语音绘图工具

项目形态：面向浏览器的在线绘图应用，用户通过自然语音完成画布创建、图形绘制、对象选择、样式调整、撤销重做、保存导出、模型切换等完整创作流程。

核心约束：正式创作流程中，用户不能使用鼠标或键盘。所有用户意图都必须有对应的语音指令入口，系统必须通过语音反馈、视觉反馈和上下文澄清完成闭环。

技术栈定稿：

- 后端：Go
- 数据库：MySQL
- 前端：React + TypeScript + Vite
- 绘图引擎：Fabric.js，优先支持对象级矢量编辑和 PNG/SVG 导出
- 通信：HTTP API + WebSocket 流式语音通道
- AI 能力：独立 AI 模型中心，支持用户选择 ASR、NLU/LLM、TTS 以及后续图像生成模型

边界说明：

- 浏览器首次麦克风授权属于系统级权限限制，Web 端很难完全绕开。产品内创作操作必须纯语音，但首次授权建议提供安装版客户端、PWA 引导或现场辅助授权方案。
- 开发阶段可以保留文本指令调试接口，但不能作为正式用户路径。
- 管理员配置 API Key、团队模型池等后台能力可以存在，但普通创作用户的模型选择必须支持语音完成。

---

## 1. 产品目标与用户场景

### 1.1 目标用户

- 无法稳定使用鼠标键盘、需要无障碍绘图能力的用户。
- 希望通过自然语言快速生成草图、流程图、教学示意图、运营素材的用户。
- 教师、内容创作者、产品经理、设计师、办公用户。
- 需要在演示、会议、课堂中边说边画的用户。

### 1.2 核心价值

- 把传统绘图工具的操作成本转化为自然语言表达成本。
- 提供完整语音闭环：听取指令、理解意图、执行绘图、播报结果、澄清错误、确认高风险操作。
- 支持复杂指令拆解，例如“画三个步骤的流程图，第一步是登录，第二步是上传文件，第三步是生成报告，把第二步标成蓝色”。
- 支持 AI 模型可选，让用户在速度、准确率、成本、隐私之间做选择。

### 1.3 典型语音流程

- “创建一个 16 比 9 的空白画布。”
- “在画布中间画一个蓝色圆形，名字叫主节点。”
- “在主节点右边添加一个绿色矩形，里面写开始处理。”
- “把绿色矩形向右移动 40 像素。”
- “选择刚才那个矩形，把边框改成深灰色。”
- “撤销上一步。”
- “打开模型中心，切换到低延迟语音识别模型。”
- “保存当前作品，并导出为 PNG。”

---

## 2. 核心功能范围

### 2.1 纯语音输入

前端通过浏览器麦克风采集音频，使用 WebSocket 将音频流发送到 Go 后端。后端根据用户当前选择的 ASR 模型进行流式或分段识别，并返回实时文本、置信度和候选结果。

必须支持：

- 自动监听或唤醒词模式。
- 语音开始、结束检测，避免每次都需要点击录音。
- 对噪声、停顿、重复表达进行容错。
- 识别失败时主动语音提示：“我没有听清，请再说一遍。”

### 2.2 指令理解

系统将 ASR 文本转换为标准绘图指令。指令理解分为三层：

- 快速规则解析：撤销、重做、确认、取消、选择上一个、放大画布等高频短命令。
- 语义解析模型：复杂自然语言指令、对象引用、空间关系、批量操作。
- 业务校验器：检查目标对象是否存在、参数是否完整、风险级别是否需要确认。

### 2.3 画布操作

MVP 支持以下对象：

- 矩形
- 圆形
- 椭圆
- 线条
- 箭头
- 文本
- 分组
- 简单图片素材，后续扩展

MVP 支持以下操作：

- 创建对象
- 选择对象
- 移动对象
- 调整大小
- 旋转
- 修改颜色、边框、透明度、字体
- 图层前移、后移、置顶、置底
- 复制、删除
- 分组、取消分组
- 撤销、重做
- 保存、导出 PNG/SVG/JSON

### 2.4 上下文引用

系统必须维护用户语音中的上下文引用：

- “刚才那个圆形”
- “左上角的矩形”
- “最大的蓝色对象”
- “第二个步骤”
- “主节点右边那个框”
- “所有红色箭头”

上下文解析需要结合：

- 当前选中对象
- 最近创建对象
- 最近修改对象
- 对象名称和别名
- 对象类型、颜色、位置、尺寸
- 操作历史
- 当前等待澄清或确认的命令

### 2.5 语音反馈

每次指令处理都必须返回可播报反馈。

反馈类型：

- 成功反馈：“已创建蓝色圆形。”
- 失败反馈：“没有找到红色矩形，请重新描述。”
- 澄清反馈：“画布中有三个圆形，你想修改左边、中间还是右边的？”
- 确认反馈：“即将删除当前选中对象，是否确认？”
- 进度反馈：“正在导出图片，请稍候。”
- 模型反馈：“已切换语音识别模型，后续指令将使用低延迟模式。”

### 2.6 撤销与重做

所有画布变更都必须写入操作日志，前端维护即时 undo/redo 栈，后端保存命令日志和周期性快照。

支持语音：

- “撤销”
- “撤销三步”
- “重做”
- “恢复刚才删除的对象”

### 2.7 保存与导出

支持语音触发：

- “保存当前作品。”
- “另存为会议流程图。”
- “导出为 PNG。”
- “导出为 SVG。”
- “导出一份可编辑 JSON。”

导出完成后，系统通过语音反馈导出结果，并在视觉界面显示下载状态。正式纯语音模式下，可以通过“读出导出链接”或“发送到我的邮箱”等扩展方式完成后续取用。

---

## 3. AI 模型中心

AI 识别与理解能力独立为“模型中心”板块。用户可以自行选择不同能力的模型，系统根据能力、延迟、成本、隐私和可用性进行路由。

### 3.1 模型中心能力分类

| 能力 | 用途 | MVP 是否需要 |
|---|---|---|
| ASR | 语音转文本 | 必须 |
| NLU/LLM | 自然语言转绘图指令 | 必须 |
| TTS | 语音反馈播报 | 必须 |
| Embedding | 对象语义检索、历史命令检索 | 可后置 |
| Image Generation | 根据描述生成背景图、贴图素材 | 可后置 |
| Vision | 分析导入图片或草图 | 可后置 |

### 3.2 模型选择原则

普通用户看到的是能力和模式，不应该被具体供应商细节打断：

- 快速模式：优先低延迟，适合连续绘图。
- 准确模式：优先理解复杂指令，适合批量创建和复杂布局。
- 隐私模式：优先本地或私有化模型。
- 低成本模式：优先价格较低的模型。

高级用户或管理员可以看到并配置具体模型：

- ASR Provider：OpenAI 兼容接口、Azure Speech、Google Speech-to-Text、本地 Whisper 类模型、讯飞、阿里云、火山等。
- NLU Provider：OpenAI 兼容接口、企业私有 LLM、规则解析器、混合解析器。
- TTS Provider：浏览器 Web Speech API、云端 TTS、本地 TTS。

说明：文档不绑定具体“最新模型名”。模型名、endpoint、价格和能力应通过配置表维护，避免代码和文档频繁跟随供应商变化。

### 3.3 模型中心用户体验

模型中心必须支持语音操作：

- “打开模型中心。”
- “读出可用的语音识别模型。”
- “选择快速模式。”
- “把指令理解模型切换为准确模式。”
- “测试当前模型。”
- “返回画布。”

视觉设计：

- 模型中心作为右侧工作面板或全屏设置面板出现。
- 列表以能力分组：语音识别、指令理解、语音反馈、图像生成。
- 每个模型显示状态、延迟档位、成本档位、隐私档位、是否支持流式。
- 当前模型用明确状态标识，而不是依赖颜色单独表达。
- 所有选项都有编号，方便用户说“选择第二个”。

密钥策略：

- 普通创作用户只能选择管理员已配置好的模型。
- BYOK 场景建议通过账号设置、OAuth 或一次性授权链接配置，不建议让用户用语音朗读 API Key。
- 模型密钥必须加密存储，后端只在调用供应商时解密使用。

### 3.4 模型路由策略

推荐路由顺序：

1. 识别唤醒词、确认、取消、撤销、重做等短命令，优先本地规则处理。
2. 普通绘图命令走用户选择的 ASR + NLU 模型。
3. 复杂多步指令走准确模式 NLU。
4. 当前模型失败时，按用户设置的 fallback 模型链路重试。
5. 低置信度或高风险操作不自动重试执行，只进入澄清或确认。

### 3.5 模型观测指标

每次模型调用记录：

- provider
- model
- capability
- latency_ms
- input_tokens 或 audio_duration_ms
- output_tokens
- confidence
- success
- error_code
- cost_estimate

这些数据用于模型中心展示“最近稳定性”和“平均响应时间”。

---

## 4. 指令理解准确性与容错

### 4.1 置信度分层

系统综合 ASR 置信度、NLU 置信度、上下文匹配度和操作风险得到 final_confidence。

建议阈值：

- final_confidence >= 0.85：低风险操作可直接执行。
- 0.70 <= final_confidence < 0.85：可以执行低风险操作，但反馈中说明理解结果；中风险操作需确认。
- 0.50 <= final_confidence < 0.70：进入澄清流程。
- final_confidence < 0.50：提示用户重新表达。

高风险操作不受高置信度豁免，必须确认。

高风险操作包括：

- 删除对象
- 清空画布
- 覆盖保存
- 批量修改
- 导出覆盖
- 切换会影响后续理解结果的模型配置

### 4.2 对象歧义处理

当候选对象多于一个时，系统计算匹配分：

- 类型匹配
- 颜色匹配
- 位置匹配
- 尺寸匹配
- 最近操作权重
- 当前选中权重
- 名称或别名匹配

如果第一候选和第二候选分差小于 0.25，必须澄清。

示例：

用户：“把圆形改成红色。”

系统：“画布中有三个圆形。你想修改左边、中间还是右边的？”

用户：“中间那个。”

系统：“已将中间的圆形改成红色。”

### 4.3 纠错机制

支持用户自然纠错：

- “不是红色，是橙色。”
- “刚才那步错了，撤销。”
- “我说的是左边的矩形，不是圆形。”
- “取消刚才的导出。”

纠错处理方式：

- 如果存在 pending_command，优先修正 pending_command。
- 如果上一条命令已执行，生成逆向命令或执行撤销后重新执行修正命令。
- 如果无法确认用户指的是哪一步，系统询问：“你想修正刚才创建圆形那一步，还是移动矩形那一步？”

---

## 5. 响应延迟目标

语音绘图体验对延迟非常敏感。系统设计必须以“先反馈、再完成长任务”为原则。

### 5.1 端到端延迟指标

| 场景 | 目标 |
|---|---|
| 唤醒词或监听状态切换 | 150ms 内有视觉反馈 |
| 撤销、重做、确认、取消 | P95 小于 800ms |
| 简单绘图命令 | P95 小于 1500ms |
| 复杂多步命令 | P95 小于 3000ms，500ms 内给出“正在规划”反馈 |
| 导出任务 | 500ms 内反馈开始，后台完成后播报结果 |

### 5.2 延迟优化策略

- 使用 WebSocket 流式上传音频，避免等整段录音结束。
- ASR 支持流式结果时，边识别边准备解析。
- 短命令本地规则优先，绕过大模型。
- 前端乐观执行低风险命令，后端异步持久化。
- 对复杂命令先返回执行计划摘要，再逐步执行。
- 模型中心记录模型延迟，用户可选择低延迟模型。
- TTS 播报不阻塞下一次语音监听。

---

## 6. 复杂指令拆解与执行

### 6.1 执行流水线

1. Audio Ingest：接收音频流。
2. ASR：生成文本、候选文本和置信度。
3. Intent Parse：解析为一个或多个意图。
4. Planning：拆解为有序命令计划。
5. Validation：校验对象、参数、权限、风险。
6. Clarification/Confirmation：必要时澄清或确认。
7. Execution：前端执行画布变更。
8. Commit：后端记录 command log、operation log、snapshot。
9. Feedback：语音和视觉反馈结果。

### 6.2 命令计划示例

用户：“画一个红色矩形，在里面写标题，再把它放到左上角。”

```json
{
  "plan_id": "plan_20260612_001",
  "mode": "execute",
  "commands": [
    {
      "id": "step_1",
      "type": "create_shape",
      "args": {
        "shape": "rect",
        "fill": "#E53935",
        "width": 240,
        "height": 120,
        "x": 640,
        "y": 360
      },
      "risk": "low",
      "confidence": 0.91
    },
    {
      "id": "step_2",
      "type": "create_text",
      "target": {
        "reference": "step_1.output.object_id",
        "placement": "inside"
      },
      "args": {
        "text": "标题",
        "font_size": 28,
        "fill": "#FFFFFF"
      },
      "depends_on": ["step_1"],
      "risk": "low",
      "confidence": 0.89
    },
    {
      "id": "step_3",
      "type": "move_object",
      "target": {
        "reference": "step_1.output.object_id"
      },
      "args": {
        "anchor": "top_left",
        "margin": 48
      },
      "depends_on": ["step_1"],
      "risk": "low",
      "confidence": 0.87
    }
  ],
  "feedback": "我将创建一个红色矩形，添加标题，并移动到左上角。"
}
```

### 6.3 执行一致性

- 每个命令必须有 command_id，保证幂等。
- 前端执行器返回 applied_operations，后端写入 operation_logs。
- 多步命令中任一步失败，默认停止后续步骤并反馈失败原因。
- 对于低风险批量命令，可以支持部分成功，但必须清楚播报：“已完成三步中的两步，第三步未执行，因为没有找到目标对象。”
- 高风险多步命令先进入确认，用户说“确认”后整体执行。

---

## 7. 前端产品与视觉设计

前端目标：实用、简洁、好看、高级。界面服务于持续创作，不做营销式首页，不做装饰性大卡片堆叠。

### 7.1 页面结构

首屏就是绘图工作台：

- 顶部状态条：麦克风状态、当前模型模式、保存状态、延迟状态。
- 中央画布：最大化展示创作结果，支持缩放和平移，但必须通过语音触发。
- 左侧对象导航：按图层列出对象，显示编号、名称、类型，便于语音选择。
- 右侧工作面板：根据语音切换为属性、模型中心、历史记录、导出面板。
- 底部语音时间线：显示最近识别文本、执行结果、澄清问题、确认状态。

所有面板必须可以通过语音打开、关闭和切换：

- “打开图层列表。”
- “切换到模型中心。”
- “隐藏历史记录。”
- “读出当前选中对象属性。”

### 7.2 视觉风格

设计关键词：

- 专业
- 克制
- 清晰
- 高对比
- 强状态反馈

建议风格：

- 背景使用浅灰白或近白工作区，减少视觉疲劳。
- 主文字使用中性深色，不使用大面积单一蓝紫渐变。
- 强调色不超过 2 到 3 个，例如青绿用于成功、琥珀用于等待、珊瑚红用于危险。
- 画布外 UI 保持低噪声，避免干扰用户看图。
- 按钮和控件在正式创作模式下主要承担状态展示，不依赖点击。

### 7.3 纯语音交互组件

必须实现：

- VoiceStatusBar：监听中、识别中、理解中、执行中、等待确认。
- TranscriptTimeline：展示最近语音和系统反馈。
- ClarificationOverlay：澄清问题浮层，自动朗读选项。
- ConfirmationOverlay：高风险确认浮层。
- ModelCenterPanel：模型选择与测试。
- ObjectNavigator：对象编号与语音可引用名称。
- CommandPreview：复杂命令执行前的计划摘要。

### 7.4 可访问性要求

- 页面所有重要状态必须可被 TTS 播报。
- 不能只靠颜色表达错误或成功，必须有文字和语音反馈。
- 所有对象应自动生成可读名称，例如“蓝色圆形一”“标题文本二”。
- 支持“读出当前画布摘要”，例如：“画布中有两个圆形、一个矩形和三条箭头。”
- 支持“读出当前选中对象”，例如：“当前选中蓝色圆形一，位于画布中间。”

---

## 8. 后端架构

后端采用 Go 模块化单体架构，MVP 不急于拆微服务，但内部边界按服务拆分，方便后续独立扩展 AI 模型中心或导出服务。

### 8.1 推荐技术选型

- Go 1.22+
- HTTP 框架：Gin
- WebSocket：nhooyr.io/websocket 或 gorilla/websocket
- MySQL 驱动：go-sql-driver/mysql
- SQL 管理：sqlc 或 GORM，优先 sqlc 保持 SQL 可控
- 数据库迁移：golang-migrate
- 配置：环境变量 + YAML，本地开发可使用 .env
- 日志：zap 或 slog
- 鉴权：JWT，后续支持 OAuth

### 8.2 后端模块

```text
cmd/server
internal/config
internal/http
internal/ws
internal/auth
internal/project
internal/canvas
internal/command
internal/voice
internal/aihub
internal/aihub/asr
internal/aihub/nlu
internal/aihub/tts
internal/modelcenter
internal/export
internal/store/mysql
internal/observability
migrations
```

### 8.3 核心服务职责

| 服务 | 职责 |
|---|---|
| ProjectService | 项目创建、查询、归档、权限校验 |
| CanvasService | 画布状态、对象状态、版本、快照 |
| VoiceSessionService | 语音会话、pending command、上下文 |
| CommandService | 指令校验、规划、风险判断、日志 |
| AIHubService | 统一 ASR/NLU/TTS 调用和 fallback |
| ModelCenterService | 模型列表、用户偏好、模型健康检查 |
| ExportService | PNG/SVG/JSON 导出任务 |
| FeedbackService | 生成可播报反馈文本 |

### 8.4 数据流

1. 用户发出语音。
2. 前端通过 WebSocket 上传音频流。
3. 后端 VoiceSessionService 维护会话状态。
4. AIHubService 调用用户选择的 ASR 模型。
5. CommandService 结合 canvas context 调用规则解析器或 NLU 模型。
6. CommandService 返回 command plan、澄清问题或确认请求。
7. 前端执行低风险画布命令并返回执行结果。
8. CanvasService 持久化对象、操作日志、快照。
9. FeedbackService 返回语音反馈。
10. 前端播报反馈并继续监听。

---

## 9. MySQL 数据库设计

所有表建议包含 `created_at`、`updated_at`，重要业务表包含软删除字段 `deleted_at`。

### 9.1 users

保存用户基础信息。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 用户 ID |
| username | VARCHAR(64) | 用户名 |
| email | VARCHAR(128) | 邮箱 |
| password_hash | VARCHAR(255) | 密码哈希 |
| role | VARCHAR(32) | user/admin |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.2 projects

保存绘图项目。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 项目 ID |
| user_id | BIGINT | 用户 ID |
| name | VARCHAR(128) | 项目名称 |
| canvas_width | INT | 画布宽度 |
| canvas_height | INT | 画布高度 |
| background | JSON | 背景配置 |
| current_version | INT | 当前版本 |
| status | VARCHAR(32) | active/archived/deleted |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.3 canvas_objects

保存画布对象最新状态。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 数据库对象 ID |
| project_id | BIGINT | 项目 ID |
| client_object_id | VARCHAR(64) | 前端对象 ID |
| object_type | VARCHAR(32) | rect/circle/text/line/arrow/group/image |
| name | VARCHAR(128) | 对象名称 |
| aliases | JSON | 语音别名 |
| properties | JSON | 位置、尺寸、颜色、字体等属性 |
| z_index | INT | 图层顺序 |
| locked | BOOLEAN | 是否锁定 |
| visible | BOOLEAN | 是否可见 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.4 operation_logs

保存可撤销的画布操作。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 操作 ID |
| project_id | BIGINT | 项目 ID |
| command_id | BIGINT | 来源指令 ID |
| operation_type | VARCHAR(64) | create/update/delete/move/group |
| before_state | JSON | 操作前状态 |
| after_state | JSON | 操作后状态 |
| version_before | INT | 操作前版本 |
| version_after | INT | 操作后版本 |
| created_at | DATETIME | 创建时间 |

### 9.5 command_logs

保存语音指令、ASR 结果、NLU 结果和执行状态。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 指令 ID |
| project_id | BIGINT | 项目 ID |
| voice_session_id | BIGINT | 语音会话 ID |
| raw_audio_ref | VARCHAR(255) | 音频引用，按隐私策略可为空 |
| asr_text | TEXT | ASR 文本 |
| asr_candidates | JSON | ASR 候选 |
| parsed_plan | JSON | 指令计划 |
| confidence | DECIMAL(5,4) | 综合置信度 |
| risk_level | VARCHAR(16) | low/medium/high |
| status | VARCHAR(32) | pending/clarifying/confirming/executed/failed/canceled |
| feedback | TEXT | 反馈文案 |
| error_message | TEXT | 错误信息 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.6 canvas_snapshots

保存画布快照。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 快照 ID |
| project_id | BIGINT | 项目 ID |
| version | INT | 版本号 |
| snapshot_data | JSON | 完整画布状态 |
| reason | VARCHAR(64) | auto/manual/export |
| created_at | DATETIME | 创建时间 |

### 9.7 voice_sessions

保存语音会话上下文。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 会话 ID |
| user_id | BIGINT | 用户 ID |
| project_id | BIGINT | 项目 ID |
| selected_object_id | VARCHAR(64) | 当前选中对象 |
| last_object_id | VARCHAR(64) | 最近操作对象 |
| pending_command | JSON | 等待澄清或确认的命令 |
| context_summary | JSON | 上下文摘要 |
| status | VARCHAR(32) | active/waiting_confirmation/waiting_clarification/closed |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.8 ai_providers

保存模型供应商配置。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | Provider ID |
| owner_user_id | BIGINT NULL | 私人配置归属，公共配置为空 |
| name | VARCHAR(64) | 显示名称 |
| provider_type | VARCHAR(64) | openai_compatible/azure/google/local/custom |
| base_url | VARCHAR(255) | API 地址 |
| encrypted_credentials | TEXT | 加密后的凭证 |
| enabled | BOOLEAN | 是否启用 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.9 ai_models

保存可选模型。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 模型 ID |
| provider_id | BIGINT | Provider ID |
| capability | VARCHAR(32) | asr/nlu/tts/image/vision/embedding |
| model_key | VARCHAR(128) | 供应商模型标识 |
| display_name | VARCHAR(128) | 展示名称 |
| supports_streaming | BOOLEAN | 是否支持流式 |
| latency_tier | VARCHAR(32) | low/medium/high |
| cost_tier | VARCHAR(32) | low/medium/high |
| privacy_tier | VARCHAR(32) | cloud/private/local |
| config_schema | JSON | 模型参数配置 |
| enabled | BOOLEAN | 是否启用 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.10 user_ai_preferences

保存用户模型选择。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 偏好 ID |
| user_id | BIGINT | 用户 ID |
| scenario | VARCHAR(64) | asr_realtime/nlu_fast/nlu_complex/tts_feedback |
| primary_model_id | BIGINT | 主模型 |
| fallback_model_ids | JSON | fallback 模型列表 |
| mode | VARCHAR(32) | fast/accurate/private/low_cost |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 9.11 model_invocation_logs

保存模型调用观测数据。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 调用 ID |
| user_id | BIGINT | 用户 ID |
| project_id | BIGINT | 项目 ID |
| model_id | BIGINT | 模型 ID |
| capability | VARCHAR(32) | asr/nlu/tts |
| latency_ms | INT | 响应耗时 |
| success | BOOLEAN | 是否成功 |
| confidence | DECIMAL(5,4) | 模型置信度 |
| error_code | VARCHAR(64) | 错误码 |
| cost_estimate | DECIMAL(12,6) | 估算成本 |
| created_at | DATETIME | 创建时间 |

---

## 10. API 与 WebSocket 设计

### 10.1 语音流 WebSocket

`WS /api/v1/projects/{project_id}/voice-stream`

客户端事件：

```json
{
  "type": "audio.chunk",
  "request_id": "req_001",
  "audio_format": "webm/opus",
  "data": "base64..."
}
```

```json
{
  "type": "voice.end",
  "request_id": "req_001"
}
```

服务端事件：

```json
{
  "type": "asr.partial",
  "request_id": "req_001",
  "text": "画一个蓝色",
  "confidence": 0.76
}
```

```json
{
  "type": "command.plan",
  "request_id": "req_001",
  "plan": {
    "mode": "execute",
    "commands": []
  },
  "feedback": "正在执行绘图指令。"
}
```

```json
{
  "type": "clarification.request",
  "request_id": "req_001",
  "question": "画布中有三个圆形，你想修改左边、中间还是右边的？",
  "options": ["左边", "中间", "右边"]
}
```

```json
{
  "type": "feedback.speak",
  "request_id": "req_001",
  "text": "已创建蓝色圆形。"
}
```

### 10.2 项目 API

```text
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
```

创建项目示例：

```json
{
  "name": "会议流程图",
  "canvas_width": 1280,
  "canvas_height": 720,
  "background": {
    "type": "solid",
    "color": "#FFFFFF"
  }
}
```

### 10.3 画布 API

```text
GET /api/v1/projects/{project_id}/canvas
PUT /api/v1/projects/{project_id}/canvas
POST /api/v1/projects/{project_id}/canvas/snapshots
GET /api/v1/projects/{project_id}/canvas/snapshots
```

### 10.4 指令 API

文本指令接口仅用于开发调试、自动化测试或无麦克风测试环境，正式用户入口仍然是语音。

```text
POST /api/v1/projects/{project_id}/text-commands
POST /api/v1/projects/{project_id}/commands/{command_id}/confirm
POST /api/v1/projects/{project_id}/commands/{command_id}/cancel
POST /api/v1/projects/{project_id}/undo
POST /api/v1/projects/{project_id}/redo
```

### 10.5 模型中心 API

```text
GET  /api/v1/ai/providers
POST /api/v1/ai/providers
GET  /api/v1/ai/models?capability=asr
POST /api/v1/ai/models/{model_id}/test
GET  /api/v1/users/me/ai-preferences
PUT  /api/v1/users/me/ai-preferences
GET  /api/v1/ai/model-metrics
```

更新模型偏好示例：

```json
{
  "preferences": [
    {
      "scenario": "asr_realtime",
      "mode": "fast",
      "primary_model_id": 12,
      "fallback_model_ids": [13, 14]
    },
    {
      "scenario": "nlu_complex",
      "mode": "accurate",
      "primary_model_id": 21,
      "fallback_model_ids": [22]
    }
  ]
}
```

### 10.6 导出 API

```text
POST /api/v1/projects/{project_id}/exports
GET  /api/v1/projects/{project_id}/exports/{export_id}
```

导出请求：

```json
{
  "format": "png",
  "scale": 2,
  "include_background": true
}
```

---

## 11. 标准绘图指令 Schema

### 11.1 顶层结构

```json
{
  "command_id": "cmd_001",
  "source": "voice",
  "asr_text": "在中间画一个蓝色圆形",
  "mode": "execute",
  "commands": [],
  "requires_confirmation": false,
  "requires_clarification": false,
  "confidence": 0.91,
  "risk_level": "low",
  "feedback": "已识别为创建蓝色圆形。"
}
```

### 11.2 Command 类型

| type | 说明 |
|---|---|
| create_canvas | 创建或调整画布 |
| create_shape | 创建图形 |
| create_text | 创建文本 |
| select_object | 选择对象 |
| update_object | 修改属性 |
| move_object | 移动对象 |
| resize_object | 调整大小 |
| rotate_object | 旋转 |
| arrange_object | 调整图层 |
| group_objects | 分组 |
| ungroup_objects | 取消分组 |
| delete_object | 删除对象 |
| undo | 撤销 |
| redo | 重做 |
| export_project | 导出 |
| switch_model | 切换 AI 模型 |
| summarize_canvas | 读出画布摘要 |

### 11.3 Target 引用方式

```json
{
  "target": {
    "type": "reference",
    "reference": "last_object"
  }
}
```

```json
{
  "target": {
    "type": "query",
    "object_type": "circle",
    "color": "blue",
    "position": "center"
  }
}
```

```json
{
  "target": {
    "type": "explicit_id",
    "object_id": "obj_123"
  }
}
```

---

## 12. 安全、隐私与合规

### 12.1 音频数据

- 默认不长期保存原始音频，仅保存 ASR 文本、置信度和命令日志。
- 如果为了调试保存音频，必须提供开关、保留周期和删除机制。
- 企业部署可以配置完全不出网的 ASR/NLU/TTS 模型。

### 12.2 模型密钥

- API Key 加密存储。
- 后端统一代理模型调用，前端不暴露密钥。
- 模型调用日志不记录敏感凭证。

### 12.3 权限控制

- 用户只能访问自己的项目。
- 团队项目后续支持 owner/editor/viewer 权限。
- 导出链接需要过期时间或鉴权访问。

---

## 13. 本地开发与运行

### 13.1 环境要求

- Go 1.22+
- MySQL 8.0+
- Node.js 20+
- 可用的 ASR/NLU/TTS 模型配置

### 13.2 后端环境变量

```bash
APP_ENV=local
HTTP_PORT=8080
MYSQL_DSN=user:password@tcp(127.0.0.1:3306)/voice_drawing?parseTime=true&charset=utf8mb4
JWT_SECRET=replace_me
EXPORT_STORAGE_PATH=./storage/exports
DEFAULT_ASR_MODEL_ID=1
DEFAULT_NLU_MODEL_ID=2
DEFAULT_TTS_MODEL_ID=3
MODEL_CREDENTIAL_SECRET=replace_me
```

### 13.3 初始化数据库

```sql
CREATE DATABASE voice_drawing DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 13.4 启动后端

```bash
go mod tidy
go run ./cmd/server
```

### 13.5 启动前端

```bash
npm install
npm run dev
```

---

## 14. MVP 范围

### 14.1 MVP 必须完成

- Go 后端基础服务和 MySQL 持久化。
- 用户、项目、画布对象、快照、命令日志。
- 模型中心基础版：可配置并选择 ASR、NLU、TTS 模型。
- WebSocket 语音流上传。
- ASR 接入，支持至少一个云端或本地 Provider。
- NLU 接入，支持规则解析 + 一个 LLM Provider。
- 标准 Command Schema。
- 前端绘图工作台。
- Fabric.js 画布执行器。
- 纯语音创建、选择、修改、移动、删除、撤销、重做。
- 语音澄清和高风险确认。
- TTS 语音反馈。
- PNG/SVG/JSON 导出。
- 端到端测试覆盖核心语音绘图流程。

### 14.2 MVP 暂缓

- 多人实时协作。
- 模板市场。
- 插件系统。
- 复杂路径编辑。
- 高级图片生成与视觉理解。
- 企业级审计后台。
- 多端同步。

---

## 15. GitHub 持续交付与 PR 计划

本项目必须采用全周期持续交付到 GitHub 的开发方式。严禁在项目末尾一次性“突击提交”。任何功能从开始实现到完成验收，都必须通过小粒度 PR 逐步合并到主分支，保证主分支在任意时间点都可启动、可查看、可复现当前演示效果。

### 15.1 GitHub 工作流

- 默认主分支为 `main`。如果仓库已有 `master`，以现有默认分支为准。
- 所有功能必须从最新主分支创建功能分支，分支命名建议为 `feat/<scope>`、`fix/<scope>`、`chore/<scope>`。
- 每个 PR 只做一件事，只实现或修改单一功能。
- 鼓励尽可能小、粒度尽可能细的 PR。大功能必须拆成多个独立 PR 分步提交。
- 每个 PR 必须可以独立 review、独立测试、独立合并。
- 每个 PR 合并后，主分支必须保持可运行状态。
- 不允许长期本地开发后一次性提交大量代码。
- 不允许在一个 PR 中混合无关改动，例如同时修改模型中心、画布导出和 UI 主题。
- 不允许绕过 CI 合并。

### 15.2 PR 标题与描述规范

每个 PR 标题必须用一句话说明新增或修改了什么，例如：

```text
feat: add project creation API
feat: add Fabric canvas renderer
fix: handle ambiguous object selection
chore: add MySQL docker compose
```

每个 PR 描述必须包含：

```markdown
## 功能描述
说明本 PR 新增或修改的功能，以及用户或开发者如何使用。

## 实现思路
说明核心技术选型、主要模块、关键数据结构或关键流程。

## 测试方式
列出已执行的验证步骤，例如：
- go test ./...
- npm run build
- docker compose up -d mysql
- 手动验证：说出“画一个蓝色圆形”，画布出现蓝色圆形。

## 影响范围
说明影响的模块、接口、数据表或页面。

## 后续事项
列出本 PR 未覆盖但后续 PR 会继续处理的内容。
```

### 15.3 合并门禁

每个 PR 合并前必须满足：

- 后端格式化通过：`go fmt ./...`
- 后端测试通过：`go test ./...`
- 前端依赖可安装：`npm install`
- 前端静态检查通过：`npm run lint`
- 前端构建通过：`npm run build`
- 数据库迁移可执行且可重复验证。
- README 中当前阶段的启动步骤可运行。
- 如果 PR 修改用户可见功能，必须补充手动验证说明或截图。
- 如果 PR 修改数据结构，必须包含 migration，并说明升级路径。
- 如果 PR 修改语音指令、模型路由或画布执行器，必须补充至少一条自动化测试或 mock 验证。

### 15.4 主分支可演示要求

主分支必须始终满足以下最低演示标准：

- `docker compose up -d mysql` 可以启动数据库。
- 后端可以启动并通过 `/healthz`。
- 前端可以启动并访问工作台页面。
- 已合并功能在 README 中有对应启动或验证说明。
- 不允许把主分支置于“等待后续 PR 才能启动”的状态。
- 如果某个能力还没有真实 AI Provider，必须使用 mock provider 保证本地可运行。

### 15.5 推荐 PR 拆分计划

以下 PR 顺序是推荐计划。实际开发时可以根据依赖微调，但必须保持“小 PR、单功能、可运行、可合并”的原则。

### PR 1：仓库基础结构

- 创建 `backend/`、`frontend/`、`docs/` 基础目录。
- 添加根目录 README、`.gitignore`、`.env.example` 占位说明。

验收：仓库结构清晰，README 说明项目目标和后续启动方式。

### PR 2：后端健康检查

- 初始化 Go module。
- 新增 Gin HTTP 服务。
- 实现 `GET /healthz`。

验收：后端可启动，访问 `/healthz` 返回正常状态。

### PR 3：MySQL 本地开发环境

- 新增 `docker-compose.yml`。
- 配置 MySQL 8.0。
- 补充数据库初始化说明。

验收：`docker compose up -d mysql` 可启动 MySQL。

### PR 4：数据库迁移框架

- 接入 migration 工具。
- 新增 migrations 目录和迁移命令。
- 创建第一批基础表迁移。

验收：本地可执行 migrate up，并能看到基础表。

### PR 5：项目 API

- 实现项目创建、列表、详情、更新接口。
- 写入 `projects` 表。

验收：可以创建项目并查询项目详情。

### PR 6：画布状态 API

- 实现读取和保存画布状态。
- 保存 `canvas_objects` 和 `canvas_snapshots`。

验收：保存画布后刷新可恢复。

### PR 7：标准 Command Schema

- 定义后端 Go struct。
- 定义前端 TypeScript 类型。
- 添加 schema 示例和测试样例。

验收：前后端对 command plan 的字段理解一致。

### PR 8：规则指令解析器

- 支持简单中文文本指令解析。
- 覆盖创建圆形、矩形、文本、颜色修改、移动、撤销、重做。

验收：`POST /text-commands` 返回标准 command plan。

### PR 9：模型中心数据模型

- 新增 `ai_providers`、`ai_models`、`user_ai_preferences`、`model_invocation_logs` 迁移。
- 初始化 mock 模型数据。

验收：迁移后可查询到 mock ASR、NLU、TTS 模型。

### PR 10：模型中心 API

- 实现模型列表、用户偏好读取、用户偏好保存、模型测试接口。

验收：用户可以选择并保存模型模式。

### PR 11：AIHub mock provider

- 实现 ASRProvider、NLUProvider、TTSProvider 接口。
- 接入 mock provider。

验收：无外部 API Key 时，本地仍可完成模拟识别和解析。

### PR 12：语音 WebSocket 后端

- 实现 `WS /voice-stream`。
- 支持音频 chunk、voice end、asr partial、command plan、feedback 事件。

验收：WebSocket mock 客户端可收到完整事件流。

### PR 13：前端工作台壳层

- 初始化 React + TypeScript + Vite。
- 创建主工作台布局：顶部状态栏、中央画布区域、左右面板、底部语音时间线。

验收：前端可启动，首屏就是绘图工作台。

### PR 14：Fabric.js 画布渲染

- 接入 Fabric.js。
- 渲染基础图形、文本和箭头。

验收：固定 canvas state 可以正确显示。

### PR 15：对象导航面板

- 实现左侧对象列表。
- 显示对象编号、名称、类型和选中状态。

验收：画布对象变化后列表同步更新。

### PR 16：文本指令调试入口

- 新增开发调试用文本指令框。
- 调用后端 `/text-commands`。
- 明确标注该入口仅用于开发调试。

验收：输入“画一个蓝色圆形”可收到 command plan。

### PR 17：前端命令执行器基础能力

- 执行 `create_shape`、`create_text`、`update_object`、`move_object`。
- 执行后同步画布状态到后端。

验收：文本调试命令可以改变画布。

### PR 18：撤销与重做

- 实现前端 undo/redo 栈。
- 后端记录 operation logs。

验收：多步绘图后可以撤销和重做。

### PR 19：前端语音采集

- 使用浏览器 MediaRecorder 采集音频。
- 通过 WebSocket 发送到后端。
- 展示监听、识别、理解、执行状态。

验收：录音后能收到 mock ASR 和 command plan。

### PR 20：语音反馈

- 接入浏览器 TTS 或 mock TTS。
- 播报系统反馈。
- TTS 不阻塞下一次监听。

验收：执行命令后能听到或看到反馈文本。

### PR 21：澄清与确认流程

- 实现歧义澄清弹层。
- 实现高风险操作确认弹层。
- 删除、清空、覆盖类操作必须确认。

验收：删除对象前系统要求确认，取消后不执行删除。

### PR 22：模型中心前端

- 实现右侧模型中心面板。
- 支持查看模型、切换模式、测试模型。
- 支持语音指令打开模型中心和切换模式。

验收：用户可以切换快速模式、准确模式、隐私模式、低成本模式。

### PR 23：导出功能

- 支持 PNG、SVG、JSON 导出。
- 导出完成后显示并播报结果。

验收：语音或调试指令“导出为 PNG”可以生成文件。

### PR 24：纯语音主路径联调

- 串联语音采集、ASR mock、NLU mock、命令执行、画布同步、语音反馈。
- 禁用正式创作模式下的鼠标键盘绘图入口。

验收：用户不使用鼠标键盘，可以完成创建、修改、撤销、导出。

### PR 25：端到端测试与演示脚本

- 添加核心 E2E 测试。
- 添加演示数据和本地演示脚本。
- 补充 README 演示流程。

验收：从零启动后可以复现完整 MVP 演示。

---

## 16. 验收标准

### 16.1 功能验收

- 用户只通过语音完成项目创建、绘图、对象选择、样式修改、撤销、重做、保存、导出。
- 用户可以通过语音打开模型中心并切换 ASR/NLU/TTS 模型。
- 系统能处理对象歧义并主动澄清。
- 删除、清空、覆盖保存等高风险操作必须语音确认。
- 页面刷新后项目能恢复。

### 16.2 性能验收

- 简单命令 P95 小于 1.5 秒。
- 撤销、确认、取消 P95 小于 800ms。
- 复杂命令 500ms 内给出处理反馈。
- 模型调用延迟和失败率可在日志中追踪。

### 16.3 体验验收

- 视觉界面不依赖鼠标键盘完成创作。
- 当前状态始终明确：监听中、识别中、等待确认、执行中、已完成。
- 文案简短、直接、可播报。
- 前端布局清爽，画布优先，辅助信息不抢占创作空间。

---

## 17. 主要风险与应对

| 风险 | 应对 |
|---|---|
| 浏览器首次麦克风权限需要用户动作 | 提供 PWA/客户端方案或一次性授权引导，产品内创作仍保持纯语音 |
| ASR 误识别导致错误绘图 | 使用置信度、候选文本、上下文校验和撤销机制 |
| LLM 输出不稳定 | 强制 JSON Schema、后端校验、规则 fallback |
| 响应慢影响创作流 | 流式 ASR、短命令规则解析、模型延迟监控、乐观执行 |
| 对象引用歧义 | 对象命名、编号、空间关系评分、语音澄清 |
| 模型成本不可控 | 模型中心展示成本档位，记录调用量，提供低成本模式 |
| 隐私合规风险 | 默认不保存音频，支持私有化模型，API Key 加密 |

---

## 18. 后续扩展方向

- 流程图、思维导图、组织架构图等专用绘图模式。
- 语音模板：“创建一个三步骤流程图模板。”
- 多轮创作记忆：“把刚才那组节点整体放大一点。”
- AI 图片素材生成：“生成一个科技风背景图放到最底层。”
- 企业私有化部署。
- 插件化命令系统，让业务方扩展自定义语音命令。
- 多人协作和实时同步。
