import {
  Activity,
  Bot,
  Circle,
  Download,
  Layers,
  Mic,
  MousePointer2,
  PanelRight,
  RotateCw,
  Square,
  Type,
  Volume2,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { defaultRuntimeConfig, saveCanvasState, type RuntimeConfig } from './api/client'
import { executeCommandPlan } from './commands/executeCommandPlan'
import { FabricCanvas, type FabricCanvasHandle } from './components/FabricCanvas'
import { ModelCenterPanel } from './components/ModelCenterPanel'
import { RuntimeConfigPanel } from './components/RuntimeConfigPanel'
import { TextCommandDebug } from './components/TextCommandDebug'
import { VoiceControl } from './components/VoiceControl'
import type { CanvasState } from './types/canvas'
import type { CommandPlan } from './types/commands'

const timeline = [
  { label: '监听', state: '待命' },
  { label: '识别', state: 'Mock ASR' },
  { label: '理解', state: '规则解析' },
  { label: '执行', state: '等待指令' },
]

const commandTips = [
  '画一个蓝色圆形',
  '画一个红色矩形',
  '画一个绿色椭圆',
  '画一个黄色三角形',
  '画一个蓝色菱形',
  '画一个红色五角星',
  '画一条黑色箭头',
  '创建一个便签',
  '创建一个流程节点',
  '创建一个图片占位',
  '写“开始处理”',
  '把文字改成“完成”',
  '把字号改成48',
  '文字加粗',
  '文字右对齐',
  '把它改成绿色',
  '把边框改成红色',
  '向右移动',
  '所有对象左对齐',
  '所有对象水平居中',
  '所有对象水平等距分布',
  '放大当前对象',
  '旋转当前对象',
  '复制当前对象',
  '把所有对象分组',
  '取消分组',
  '删除当前对象',
  '置顶当前对象',
  '清空画布',
  '导出 PNG',
]

const initialCanvasState: CanvasState = {
  width: 1280,
  height: 720,
  objects: [
    {
      object_key: 'obj_1',
      object_type: 'circle',
      name: '主圆形',
      properties: { fill: '#2563eb', stroke: '#1e40af', stroke_width: 0, left: 540, top: 300, radius: 82 },
    },
    {
      object_key: 'obj_2',
      object_type: 'rect',
      name: '流程框',
      properties: { fill: '#dc2626', stroke: '#991b1b', stroke_width: 0, left: 760, top: 430, width: 250, height: 145 },
    },
  ],
}

export function App() {
  const projectId = 1
  const fabricRef = useRef<FabricCanvasHandle | null>(null)
  const [canvasState, setCanvasState] = useState(initialCanvasState)
  const [undoStack, setUndoStack] = useState<CanvasState[]>([])
  const [redoStack, setRedoStack] = useState<CanvasState[]>([])
  const [selectedObjectKey, setSelectedObjectKey] = useState(canvasState.objects[0]?.object_key ?? '')
  const [lastFeedback, setLastFeedback] = useState('工作台已就绪')
  const [pendingPlan, setPendingPlan] = useState<CommandPlan | null>(null)
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(() => {
    const saved = localStorage.getItem('ai_voice_drawing_runtime_config')
    if (!saved) {
      return defaultRuntimeConfig
    }
    try {
      return { ...defaultRuntimeConfig, ...JSON.parse(saved) }
    } catch {
      return defaultRuntimeConfig
    }
  })
  const objectRows = useMemo(
    () =>
      canvasState.objects.map((object, index) => ({
        id: String(index + 1).padStart(2, '0'),
        key: object.object_key,
        name: object.name ?? object.object_key,
        type: describeType(object.object_type),
        tone: describeFill(object.properties.fill ?? object.properties.stroke),
      })),
    [canvasState.objects],
  )

  async function applyCommandPlan(plan: CommandPlan) {
    if (plan.requires_clarification || plan.commands.length === 0) {
      setLastFeedback(plan.feedback || '需要澄清指令。')
      speak(plan.feedback || '需要澄清指令。')
      return
    }
    if (!pendingPlan && (plan.requires_confirmation || plan.risk_level === 'high')) {
      setPendingPlan(plan)
      setLastFeedback(plan.feedback || '需要确认。')
      speak(plan.feedback || '需要确认。')
      return
    }
    setPendingPlan(null)

    const firstType = plan.commands[0]?.type
    if (firstType === 'undo') {
      applyUndo(plan.feedback)
      return
    }
    if (firstType === 'redo') {
      applyRedo(plan.feedback)
      return
    }

    const result = executeCommandPlan(canvasState, selectedObjectKey, plan)
    if (result.requestedExport === 'png') {
      exportPNG(plan.feedback || '已导出 PNG。')
      return
    }
    setUndoStack((previous) => [...previous, canvasState])
    setRedoStack([])
    setCanvasState(result.state)
    setSelectedObjectKey(result.selectedObjectKey)
    setLastFeedback(result.message)
    speak(result.message)
    try {
      await saveCanvasState(projectId, result.state, runtimeConfig)
    } catch {
      setLastFeedback(`${result.message} 画布同步待重试。`)
    }
  }

  function updateRuntimeConfig(next: RuntimeConfig) {
    setRuntimeConfig(next)
    localStorage.setItem('ai_voice_drawing_runtime_config', JSON.stringify(next))
    setLastFeedback(next.mockMode ? '已切换到本地 mock 演示。' : '已切换到真实后端连接。')
  }

  function confirmPendingPlan() {
    if (pendingPlan) {
      void applyCommandPlan(pendingPlan)
    }
  }

  function cancelPendingPlan() {
    setPendingPlan(null)
    setLastFeedback('指令已取消。')
    speak('指令已取消。')
  }

  function applyUndo(feedback: string) {
    const previous = undoStack.at(-1)
    if (!previous) {
      setLastFeedback('没有可以撤销的步骤。')
      return
    }
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack, canvasState])
    setCanvasState(previous)
    setSelectedObjectKey(previous.objects.at(-1)?.object_key ?? '')
    setLastFeedback(feedback || '已撤销。')
    speak(feedback || '已撤销。')
  }

  function applyRedo(feedback: string) {
    const next = redoStack.at(-1)
    if (!next) {
      setLastFeedback('没有可以重做的步骤。')
      return
    }
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) => [...stack, canvasState])
    setCanvasState(next)
    setSelectedObjectKey(next.objects.at(-1)?.object_key ?? '')
    setLastFeedback(feedback || '已重做。')
    speak(feedback || '已重做。')
  }

  function exportPNG(feedback = 'PNG 已导出。') {
    const dataURL = fabricRef.current?.exportPNG()
    if (!dataURL) {
      setLastFeedback('导出还未准备好。')
      return
    }
    const link = document.createElement('a')
    link.href = dataURL
    link.download = 'ai-voice-drawing.png'
    link.click()
    setLastFeedback(feedback)
    speak(feedback)
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand">
          <Bot size={20} />
          <span>AI 语音绘图工作台</span>
        </div>
        <div className="status-strip">
          <span><Mic size={16} /> 麦克风待授权</span>
          <span><Activity size={16} /> {runtimeConfig.mockMode ? '本地 mock 模式' : '真实后端模式'}</span>
          <span><Volume2 size={16} /> 语音反馈开启</span>
        </div>
      </header>

      <section className="main-grid">
        <aside className="object-panel" aria-label="对象导航">
          <div className="panel-title">
            <MousePointer2 size={17} />
            <span>对象导航</span>
          </div>
          <div className="object-list">
            {objectRows.map((item) => (
              <button
                className={`object-row ${item.key === selectedObjectKey ? 'is-selected' : ''}`}
                key={item.key}
                type="button"
                onClick={() => setSelectedObjectKey(item.key)}
              >
                <span className="object-index">{item.id}</span>
                <span className="object-meta">
                  <strong>{item.name}</strong>
                  <small>{item.type} · {item.tone}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="canvas-area" aria-label="绘图工作台">
          <div className="canvas-toolbar">
            <span><Circle size={16} /> 圆形 / 椭圆</span>
            <span><Square size={16} /> 矩形 / 线条</span>
            <span><Type size={16} /> 文字</span>
            <span><RotateCw size={16} /> 移动 / 缩放 / 旋转</span>
            <button type="button" onClick={() => exportPNG()} title="导出 PNG">
              <Download size={16} /> PNG
            </button>
          </div>
          <div className="canvas-surface">
            <FabricCanvas ref={fabricRef} state={canvasState} />
          </div>
        </section>

        <aside className="model-panel" aria-label="控制面板">
          <div className="panel-title">
            <PanelRight size={17} />
            <span>控制面板</span>
          </div>
          <RuntimeConfigPanel config={runtimeConfig} onChange={updateRuntimeConfig} />
          <ModelCenterPanel config={runtimeConfig} />
          <div className="model-row">
            <strong>执行反馈</strong>
            <span>{lastFeedback}</span>
          </div>
          {pendingPlan ? (
            <div className="confirmation-panel">
              <strong>需要确认</strong>
              <span>{pendingPlan.feedback}</span>
              <div className="confirmation-actions">
                <button type="button" onClick={confirmPendingPlan}>确认</button>
                <button type="button" onClick={cancelPendingPlan}>取消</button>
              </div>
            </div>
          ) : null}
          <VoiceControl config={runtimeConfig} projectId={projectId} onPlan={applyCommandPlan} onStatus={(message) => {
            setLastFeedback(message)
            speak(message)
          }} />
          <TextCommandDebug config={runtimeConfig} projectId={projectId} onPlan={applyCommandPlan} />
          <section className="command-cheatsheet" aria-label="语音命令速查">
            <div className="panel-title">
              <Layers size={17} />
              <span>语音命令速查</span>
            </div>
            <div className="command-chip-list">
              {commandTips.map((tip) => (
                <span key={tip}>{tip}</span>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <footer className="voice-timeline">
        {timeline.map((item) => (
          <div className="timeline-step" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.state}</strong>
          </div>
        ))}
      </footer>
    </main>
  )
}

function describeType(value: string) {
  const types: Record<string, string> = {
    circle: '圆形',
    rect: '矩形',
    ellipse: '椭圆',
    line: '线条',
    arrow: '箭头',
    triangle: '三角形',
    diamond: '菱形',
    star: '星形',
    sticky: '便签',
    process: '流程节点',
    image_placeholder: '图片占位',
    group: '分组',
    text: '文字',
  }
  return types[value] ?? value
}

function describeFill(value: unknown) {
  if (value === '#2563eb') return '蓝色'
  if (value === '#dc2626') return '红色'
  if (value === '#16a34a') return '绿色'
  if (value === '#facc15') return '黄色'
  if (value === '#111827') return '黑色'
  if (value === '#ffffff') return '白色'
  return typeof value === 'string' ? value : '默认'
}

function speak(text: string) {
  if (!('speechSynthesis' in window) || !text) {
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  window.speechSynthesis.speak(utterance)
}
