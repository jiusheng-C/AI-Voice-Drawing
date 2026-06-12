import { Activity, Bot, Circle, Mic, MousePointer2, PanelRight, Square, Volume2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { saveCanvasState } from './api/client'
import { executeCommandPlan } from './commands/executeCommandPlan'
import { FabricCanvas } from './components/FabricCanvas'
import { TextCommandDebug } from './components/TextCommandDebug'
import { VoiceControl } from './components/VoiceControl'
import type { CanvasState } from './types/canvas'
import type { CommandPlan } from './types/commands'

const timeline = [
  { label: 'Listen', state: 'Ready' },
  { label: 'ASR', state: 'Mock ASR' },
  { label: 'NLU', state: 'Rule parser' },
  { label: 'Execute', state: 'Waiting' },
]

const initialCanvasState: CanvasState = {
  width: 1280,
  height: 720,
  objects: [
    {
      object_key: 'obj_1',
      object_type: 'circle',
      name: 'Main circle',
      properties: { fill: '#2563eb', left: 540, top: 300, radius: 82 },
    },
    {
      object_key: 'obj_2',
      object_type: 'rect',
      name: 'Flow box',
      properties: { fill: '#dc2626', left: 760, top: 430, width: 250, height: 145 },
    },
  ],
}

export function App() {
  const projectId = 1
  const [canvasState, setCanvasState] = useState(initialCanvasState)
  const [undoStack, setUndoStack] = useState<CanvasState[]>([])
  const [redoStack, setRedoStack] = useState<CanvasState[]>([])
  const [selectedObjectKey, setSelectedObjectKey] = useState(canvasState.objects[0]?.object_key ?? '')
  const [lastFeedback, setLastFeedback] = useState('Ready')
  const [pendingPlan, setPendingPlan] = useState<CommandPlan | null>(null)
  const objectRows = useMemo(
    () =>
      canvasState.objects.map((object, index) => ({
        id: String(index + 1).padStart(2, '0'),
        key: object.object_key,
        name: object.name ?? object.object_key,
        type: object.object_type,
        tone: describeFill(object.properties.fill),
      })),
    [canvasState.objects],
  )

  async function applyCommandPlan(plan: CommandPlan) {
    if (plan.requires_clarification || plan.commands.length === 0) {
      setLastFeedback(plan.feedback || 'Clarification required.')
      speak(plan.feedback || 'Clarification required.')
      return
    }
    if (!pendingPlan && (plan.requires_confirmation || plan.risk_level === 'high')) {
      setPendingPlan(plan)
      setLastFeedback(plan.feedback || 'Confirmation required.')
      speak(plan.feedback || 'Confirmation required.')
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
    setUndoStack((previous) => [...previous, canvasState])
    setRedoStack([])
    setCanvasState(result.state)
    setSelectedObjectKey(result.selectedObjectKey)
    setLastFeedback(result.message)
    speak(result.message)
    try {
      await saveCanvasState(projectId, result.state)
    } catch {
      setLastFeedback(`${result.message} Canvas sync pending.`)
    }
  }

  function confirmPendingPlan() {
    if (pendingPlan) {
      void applyCommandPlan(pendingPlan)
    }
  }

  function cancelPendingPlan() {
    setPendingPlan(null)
    setLastFeedback('Command canceled.')
    speak('Command canceled.')
  }

  function applyUndo(feedback: string) {
    const previous = undoStack.at(-1)
    if (!previous) {
      setLastFeedback('Nothing to undo.')
      return
    }
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack, canvasState])
    setCanvasState(previous)
    setSelectedObjectKey(previous.objects.at(-1)?.object_key ?? '')
    setLastFeedback(feedback || 'Undo complete.')
    speak(feedback || 'Undo complete.')
  }

  function applyRedo(feedback: string) {
    const next = redoStack.at(-1)
    if (!next) {
      setLastFeedback('Nothing to redo.')
      return
    }
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) => [...stack, canvasState])
    setCanvasState(next)
    setSelectedObjectKey(next.objects.at(-1)?.object_key ?? '')
    setLastFeedback(feedback || 'Redo complete.')
    speak(feedback || 'Redo complete.')
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand">
          <Bot size={20} />
          <span>AI Voice Drawing</span>
        </div>
        <div className="status-strip">
          <span><Mic size={16} /> Microphone pending</span>
          <span><Activity size={16} /> Mock fast mode</span>
          <span><Volume2 size={16} /> Voice feedback on</span>
        </div>
      </header>

      <section className="main-grid">
        <aside className="object-panel" aria-label="Object navigation">
          <div className="panel-title">
            <MousePointer2 size={17} />
            <span>Objects</span>
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

        <section className="canvas-area" aria-label="Drawing workspace">
          <div className="canvas-toolbar">
            <span><Circle size={16} /> Circle</span>
            <span><Square size={16} /> Rectangle</span>
          </div>
          <div className="canvas-surface">
            <FabricCanvas state={canvasState} />
          </div>
        </section>

        <aside className="model-panel" aria-label="Model center preview">
          <div className="panel-title">
            <PanelRight size={17} />
            <span>Model Center</span>
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
          <div className="model-row">
            <strong>Feedback</strong>
            <span>{lastFeedback}</span>
          </div>
          {pendingPlan ? (
            <div className="confirmation-panel">
              <strong>Confirmation</strong>
              <span>{pendingPlan.feedback}</span>
              <div className="confirmation-actions">
                <button type="button" onClick={confirmPendingPlan}>Confirm</button>
                <button type="button" onClick={cancelPendingPlan}>Cancel</button>
              </div>
            </div>
          ) : null}
          <VoiceControl projectId={projectId} onPlan={applyCommandPlan} onStatus={(message) => {
            setLastFeedback(message)
            speak(message)
          }} />
          <TextCommandDebug projectId={projectId} onPlan={applyCommandPlan} />
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

function describeFill(value: unknown) {
  if (value === '#2563eb') return 'Blue'
  if (value === '#dc2626') return 'Red'
  if (value === '#16a34a') return 'Green'
  return typeof value === 'string' ? value : 'Default'
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
