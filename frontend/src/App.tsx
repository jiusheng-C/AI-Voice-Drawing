import { Activity, Bot, Circle, Mic, MousePointer2, PanelRight, Square, Volume2 } from 'lucide-react'

const timeline = [
  { label: '监听', state: '就绪' },
  { label: '识别', state: 'Mock ASR' },
  { label: '理解', state: '规则解析' },
  { label: '执行', state: '等待指令' },
]

const objects = [
  { id: '01', name: '主圆形', type: 'Circle', tone: '蓝色' },
  { id: '02', name: '流程框', type: 'Rect', tone: '红色' },
]

export function App() {
  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand">
          <Bot size={20} />
          <span>AI Voice Drawing</span>
        </div>
        <div className="status-strip">
          <span><Mic size={16} /> 麦克风待授权</span>
          <span><Activity size={16} /> Mock 快速模式</span>
          <span><Volume2 size={16} /> 语音反馈开启</span>
        </div>
      </header>

      <section className="main-grid">
        <aside className="object-panel" aria-label="对象导航">
          <div className="panel-title">
            <MousePointer2 size={17} />
            <span>对象</span>
          </div>
          <div className="object-list">
            {objects.map((item) => (
              <button className="object-row" key={item.id} type="button">
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
            <span><Circle size={16} /> 圆形</span>
            <span><Square size={16} /> 矩形</span>
          </div>
          <div className="canvas-surface">
            <div className="shape circle-shape" />
            <div className="shape rect-shape" />
          </div>
        </section>

        <aside className="model-panel" aria-label="模型中心预览">
          <div className="panel-title">
            <PanelRight size={17} />
            <span>模型中心</span>
          </div>
          <div className="model-row">
            <strong>ASR</strong>
            <span>Mock ASR Fast</span>
          </div>
          <div className="model-row">
            <strong>NLU</strong>
            <span>Mock Rule Parser</span>
          </div>
          <div className="model-row">
            <strong>TTS</strong>
            <span>Mock Browser TTS</span>
          </div>
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
