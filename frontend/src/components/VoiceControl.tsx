import { useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import type { CommandPlan } from '../types/commands'

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8080'

interface VoiceControlProps {
  projectId: number
  onPlan: (plan: CommandPlan) => Promise<void> | void
  onStatus: (message: string) => void
}

export function VoiceControl({ projectId, onPlan, onStatus }: VoiceControlProps) {
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  async function start() {
    const socket = new WebSocket(`${WS_BASE_URL}/api/v1/projects/${projectId}/voice-stream`)
    socketRef.current = socket
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data as string)
      if (message.type === 'ready' || message.type === 'asr_partial' || message.type === 'feedback') {
        onStatus(message.feedback ?? message.text ?? 'Voice event received')
      }
      if (message.type === 'command_plan' && message.command_plan) {
        await onPlan(message.command_plan as CommandPlan)
      }
    }

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error('Voice socket failed'))
    })

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      socket.send(JSON.stringify({ type: 'voice_end', text: '画一个蓝色圆形' }))
    }
    recorder.start()
    setIsRecording(true)
    onStatus('Listening')
  }

  function stop() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setIsRecording(false)
  }

  return (
    <button className={`voice-button ${isRecording ? 'is-recording' : ''}`} type="button" onClick={isRecording ? stop : start}>
      {isRecording ? <Square size={17} /> : <Mic size={17} />}
      <span>{isRecording ? 'Stop voice' : 'Start voice'}</span>
    </button>
  )
}
