import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { createMockCommandPlan, type RuntimeConfig } from '../api/client'
import type { CommandPlan } from '../types/commands'

interface VoiceControlProps {
  config: RuntimeConfig
  projectId: number
  onPlan: (plan: CommandPlan) => Promise<void> | void
  onStatus: (message: string) => void
}

type MicPermission = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

export function VoiceControl({ config, projectId, onPlan, onStatus }: VoiceControlProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [permission, setPermission] = useState<MicPermission>(() =>
    typeof navigator.mediaDevices === 'undefined' ? 'unsupported' : 'unknown',
  )
  const [lastTranscript, setLastTranscript] = useState('画一个蓝色圆形')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transcriptRef = useRef('画一个蓝色圆形')

  useEffect(() => {
    if (typeof navigator.mediaDevices === 'undefined') {
      return
    }
    const permissions = navigator.permissions
    if (!permissions?.query) {
      queueMicrotask(() => setPermission('prompt'))
      return
    }
    permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setPermission(status.state as MicPermission)
        status.onchange = () => setPermission(status.state as MicPermission)
      })
      .catch(() => setPermission('prompt'))
  }, [])

  async function start() {
    if (typeof navigator.mediaDevices === 'undefined') {
      if (config.mockMode) {
        onStatus('当前浏览器不支持麦克风，已使用本地 mock 指令。')
        await onPlan(createMockCommandPlan(transcriptRef.current, 'voice_mock') as CommandPlan)
        return
      }
      onStatus('当前浏览器不支持麦克风，请换用支持 getUserMedia 的浏览器。')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setPermission('granted')
      startSpeechRecognition()

      if (config.mockMode) {
        startLocalRecording(stream)
        onStatus('麦克风已授权，正在监听。本地 mock 会在停止后执行识别结果。')
        return
      }

      await startBackendRecording(stream)
    } catch (error) {
      setPermission('denied')
      const message = error instanceof Error ? error.message : '麦克风授权失败'
      onStatus(`麦克风授权失败：${message}`)
    }
  }

  function startLocalRecording(stream: MediaStream) {
    const recorder = typeof MediaRecorder !== 'undefined' ? new MediaRecorder(stream) : null
    recorderRef.current = recorder
    if (recorder) {
      recorder.onstop = () => {
        void finishLocalMock()
      }
      recorder.start()
    }
    setIsRecording(true)
  }

  async function startBackendRecording(stream: MediaStream) {
    const socket = new WebSocket(`${config.wsBaseUrl}/api/v1/projects/${projectId}/voice-stream`)
    socketRef.current = socket
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data as string)
      if (message.type === 'ready' || message.type === 'asr_partial' || message.type === 'feedback') {
        onStatus(message.feedback ?? message.text ?? '收到语音事件')
      }
      if (message.type === 'command_plan' && message.command_plan) {
        await onPlan(message.command_plan as CommandPlan)
      }
    }

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error('语音 WebSocket 连接失败，请检查连接配置或开启 mock 模式。'))
    })

    const recorder = typeof MediaRecorder !== 'undefined' ? new MediaRecorder(stream) : null
    recorderRef.current = recorder
    if (recorder) {
      recorder.onstop = () => {
        stopTracks()
        socket.send(JSON.stringify({ type: 'voice_end', text: transcriptRef.current || '画一个蓝色圆形' }))
        onStatus('正在处理语音指令')
      }
      recorder.start()
    }
    setIsRecording(true)
    onStatus('麦克风已授权，正在监听。')
  }

  function startSpeechRecognition() {
    const recognitionConstructor = (
      window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor
        webkitSpeechRecognition?: SpeechRecognitionConstructor
      }
    ).SpeechRecognition ?? (
      window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor
        webkitSpeechRecognition?: SpeechRecognitionConstructor
      }
    ).webkitSpeechRecognition

    if (!recognitionConstructor) {
      return
    }

    const recognition = new recognitionConstructor()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1]?.[0]?.transcript
      if (latest) {
        transcriptRef.current = latest
        setLastTranscript(latest)
      }
    }
    recognition.onerror = () => {
      onStatus('浏览器语音识别不可用，将使用默认 mock 指令。')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    } else if (config.mockMode) {
      void finishLocalMock()
    }
    recorderRef.current = null
    setIsRecording(false)
  }

  async function finishLocalMock() {
    stopTracks()
    stopRecognition()
    onStatus('正在使用本地 mock 解析语音指令')
    await onPlan(createMockCommandPlan(transcriptRef.current || '画一个蓝色圆形', 'voice_mock') as CommandPlan)
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function stopRecognition() {
    try {
      recognitionRef.current?.stop()
    } catch {
      // Some browsers throw when recognition was already stopped.
    }
    recognitionRef.current = null
  }

  const buttonLabel = isRecording ? '停止语音' : permission === 'granted' ? '开始语音' : '授权麦克风'

  return (
    <div className="voice-control">
      <button className={`voice-button ${isRecording ? 'is-recording' : ''}`} type="button" onClick={isRecording ? stop : start}>
        {isRecording ? <Square size={17} /> : <Mic size={17} />}
        <span>{buttonLabel}</span>
      </button>
      <div className="voice-status">
        <span>权限：{permissionText(permission)}</span>
        <span>识别：{lastTranscript}</span>
      </div>
    </div>
  )
}

function permissionText(permission: MicPermission) {
  if (permission === 'granted') return '已授权'
  if (permission === 'denied') return '已拒绝'
  if (permission === 'unsupported') return '不支持'
  return '待授权'
}
