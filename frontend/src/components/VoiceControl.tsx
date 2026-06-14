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
  onerror: ((event?: { error?: string }) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const DEMO_FALLBACK_TRANSCRIPT = '画一个蓝色圆形'
const TRANSCRIPT_PLACEHOLDER = '等待语音指令'
const NO_TRANSCRIPT_MESSAGE = '没有识别到有效语音，请再说一次。'

export function VoiceControl({ config, projectId, onPlan, onStatus }: VoiceControlProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [permission, setPermission] = useState<MicPermission>(() =>
    typeof navigator.mediaDevices === 'undefined' ? 'unsupported' : 'unknown',
  )
  const [lastTranscript, setLastTranscript] = useState(TRANSCRIPT_PLACEHOLDER)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transcriptRef = useRef('')
  const finishingRef = useRef(false)

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
    if (isRecording) {
      return
    }

    finishingRef.current = false
    transcriptRef.current = ''
    setLastTranscript('正在聆听...')

    if (typeof navigator.mediaDevices === 'undefined') {
      setPermission('unsupported')
      await executeLocalFallback('当前浏览器不支持麦克风，已使用本地 mock 指令继续演示。')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error) {
      setPermission('denied')
      const message = error instanceof Error ? error.message : '浏览器拒绝麦克风授权'
      await executeLocalFallback(`麦克风授权失败：${message}。已使用本地 mock 指令保证演示闭环。`)
      return
    }

    streamRef.current = stream
    setPermission('granted')

    const recognitionStarted = startSpeechRecognition()
    if (typeof MediaRecorder === 'undefined') {
      stopTracks()
      stopRecognition()
      await executeLocalFallback('当前浏览器不支持 MediaRecorder，已改用本地 mock 指令。')
      return
    }

    if (config.mockMode) {
      startLocalRecording(stream, recognitionStarted)
      return
    }

    await startBackendRecording(stream, recognitionStarted)
  }

  function startLocalRecording(stream: MediaStream, recognitionStarted: boolean) {
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.onstop = () => {
      void finishLocalMock('正在使用本地 mock 解析语音指令。')
    }
    recorder.start()
    setIsRecording(true)
    onStatus(
      recognitionStarted
        ? '麦克风已授权，正在监听。停止后将执行识别结果。'
        : '麦克风已授权，但浏览器语音识别不可用。停止后将使用默认 mock 指令。',
    )
  }

  async function startBackendRecording(stream: MediaStream, recognitionStarted: boolean) {
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

    try {
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        socket.onerror = () => reject(new Error('语音 WebSocket 连接失败'))
      })
    } catch (error) {
      closeSocket()
      await finishLocalMock(
        `${error instanceof Error ? error.message : '语音 WebSocket 不可用'}，已自动切换到本地 mock 指令。`,
      )
      return
    }

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.onstop = () => {
      stopTracks()
      stopRecognition()
      if (socket.readyState === WebSocket.OPEN) {
        const transcript = getTranscript()
        if (!transcript) {
          closeSocket()
          setLastTranscript(TRANSCRIPT_PLACEHOLDER)
          onStatus(NO_TRANSCRIPT_MESSAGE)
          return
        }
        socket.send(JSON.stringify({ type: 'voice_end', text: transcript }))
        onStatus('正在处理语音指令。')
      } else {
        void finishLocalMock('语音连接已断开，已自动切换到本地 mock 指令。')
      }
    }
    recorder.start()
    setIsRecording(true)
    onStatus(
      recognitionStarted
        ? '麦克风已授权，正在通过后端语音通道监听。'
        : '后端语音通道已连接，但浏览器实时转写不可用；停止后将用默认文本收尾。',
    )
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
      return false
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
    recognition.onerror = (event) => {
      onStatus(`浏览器语音识别暂不可用${event?.error ? `：${event.error}` : ''}。停止后会自动使用本地 mock 兜底。`)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      return true
    } catch {
      recognitionRef.current = null
      return false
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    } else {
      void finishLocalMock('没有可用录音流，已使用本地 mock 指令继续。')
    }
    recorderRef.current = null
    setIsRecording(false)
  }

  async function finishLocalMock(message: string) {
    if (finishingRef.current) {
      return
    }
    finishingRef.current = true
    setIsRecording(false)
    stopTracks()
    stopRecognition()
    closeSocket()
    onStatus(message)
    const transcript = getTranscript()
    if (!transcript) {
      setLastTranscript(TRANSCRIPT_PLACEHOLDER)
      onStatus(NO_TRANSCRIPT_MESSAGE)
      finishingRef.current = false
      return
    }
    await onPlan(createMockCommandPlan(transcript, 'voice_mock') as CommandPlan)
    finishingRef.current = false
  }

  async function executeLocalFallback(message: string) {
    setIsRecording(false)
    stopTracks()
    stopRecognition()
    closeSocket()
    onStatus(message)
    transcriptRef.current = DEMO_FALLBACK_TRANSCRIPT
    setLastTranscript(DEMO_FALLBACK_TRANSCRIPT)
    await onPlan(createMockCommandPlan(DEMO_FALLBACK_TRANSCRIPT, 'voice_mock') as CommandPlan)
  }

  function getTranscript() {
    return transcriptRef.current.trim()
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

  function closeSocket() {
    const socket = socketRef.current
    if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
      socket.close()
    }
    socketRef.current = null
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
