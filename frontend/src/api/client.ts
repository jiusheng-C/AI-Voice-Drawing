import type { CommandPlan, CommandType, RiskLevel, TargetType } from '../types/commands'

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
const DEFAULT_WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8080'

export interface RuntimeConfig {
  apiBaseUrl: string
  wsBaseUrl: string
  mockMode: boolean
}

export const defaultRuntimeConfig: RuntimeConfig = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  wsBaseUrl: DEFAULT_WS_BASE_URL,
  mockMode: true,
}

export async function postTextCommand(projectId: number, text: string, config = defaultRuntimeConfig) {
  if (config.mockMode) {
    return { command_plan: createMockCommandPlan(text, 'text_debug') }
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/v1/projects/${projectId}/text-commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`Command parser failed with status ${response.status}`)
    }

    return (await response.json()) as { command_plan: unknown }
  } catch (error) {
    if (config.mockMode) {
      return { command_plan: createMockCommandPlan(text, 'text_debug') }
    }
    throw error
  }
}

export async function saveCanvasState(projectId: number, state: unknown, config = defaultRuntimeConfig) {
  if (config.mockMode) {
    return { saved: true, project_id: projectId, state }
  }

  const response = await fetch(`${config.apiBaseUrl}/api/v1/projects/${projectId}/canvas-state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })

  if (!response.ok) {
    throw new Error(`Canvas sync failed with status ${response.status}`)
  }

  return response.json()
}

export async function fetchAIModels(config = defaultRuntimeConfig) {
  if (config.mockMode) {
    return { models: mockModels }
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/v1/ai/models`)
    if (!response.ok) {
      throw new Error(`Model list failed with status ${response.status}`)
    }
    return (await response.json()) as { models: AIModel[] }
  } catch (error) {
    if (config.mockMode) {
      return { models: mockModels }
    }
    throw error
  }
}

export async function saveAIPreferences(preferences: unknown[], config = defaultRuntimeConfig) {
  if (config.mockMode) {
    localStorage.setItem('ai_voice_drawing_model_preferences', JSON.stringify(preferences))
    return { preferences }
  }

  const response = await fetch(`${config.apiBaseUrl}/api/v1/users/me/ai-preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  })
  if (!response.ok) {
    throw new Error(`Preference save failed with status ${response.status}`)
  }
  return response.json()
}

export function createMockCommandPlan(text: string, source: string): CommandPlan {
  const normalized = text.replace(/\s/g, '')
  const color = parseColor(normalized)
  const base = {
    command_id: `cmd_mock_${Date.now()}`,
    source,
    asr_text: text,
    mode: 'execute' as const,
    requires_confirmation: false,
    requires_clarification: false,
    confidence: 0.92,
    risk_level: 'low' as const,
  }

  if (normalized.includes('撤销')) {
    return {
      ...base,
      feedback: '已撤销上一步。',
      commands: [mockStep('undo')],
    }
  }

  if (normalized.includes('重做') || normalized.includes('恢复')) {
    return {
      ...base,
      feedback: '已重做。',
      commands: [mockStep('redo')],
    }
  }

  if (normalized.includes('矩形') || normalized.includes('方形')) {
    return {
      ...base,
      feedback: `已创建${color.name}矩形。`,
      commands: [
        mockStep('create_shape', {
          shape: 'rect',
          fill: color.hex,
          x: 640,
          y: 360,
          width: 240,
          height: 150,
        }),
      ],
    }
  }

  if (normalized.includes('圆')) {
    return {
      ...base,
      feedback: `已创建${color.name}圆形。`,
      commands: [
        mockStep('create_shape', {
          shape: 'circle',
          fill: color.hex,
          x: 640,
          y: 360,
          radius: 80,
        }),
      ],
    }
  }

  if (normalized.includes('改成') || normalized.includes('变成') || normalized.includes('颜色')) {
    return {
      ...base,
      feedback: `已把最近对象改成${color.name}。`,
      commands: [
        mockStep(
          'update_object',
          { fill: color.hex },
          { type: 'reference', reference: 'last_object' },
        ),
      ],
    }
  }

  return {
    ...base,
    mode: 'plan',
    requires_clarification: true,
    confidence: 0.35,
    feedback: '我还不能确定这条指令，请换一种说法。',
    commands: [],
  }
}

function mockStep(
  type: CommandType,
  args?: Record<string, unknown>,
  target?: { type: TargetType; reference?: string },
) {
  return {
    id: 'step_1',
    type,
    target,
    args,
    risk: 'low' as RiskLevel,
    confidence: 0.92,
  }
}

function parseColor(text: string) {
  if (text.includes('红')) return { name: '红色', hex: '#dc2626' }
  if (text.includes('绿')) return { name: '绿色', hex: '#16a34a' }
  if (text.includes('黄')) return { name: '黄色', hex: '#facc15' }
  if (text.includes('黑')) return { name: '黑色', hex: '#111827' }
  if (text.includes('白')) return { name: '白色', hex: '#ffffff' }
  return { name: '蓝色', hex: '#2563eb' }
}

export interface AIModel {
  id: number
  model_key: string
  display_name: string
  capability: 'asr' | 'nlu' | 'tts' | string
  mode: string
  latency_tier: string
  cost_tier: string
  privacy_tier: string
  supports_streaming: boolean
}

const mockModels: AIModel[] = [
  {
    id: 1,
    model_key: 'mock-asr-fast',
    display_name: 'Mock ASR Fast',
    capability: 'asr',
    mode: 'fast',
    latency_tier: 'low',
    cost_tier: 'free',
    privacy_tier: 'local',
    supports_streaming: true,
  },
  {
    id: 2,
    model_key: 'mock-nlu-rule',
    display_name: 'Mock Rule Parser',
    capability: 'nlu',
    mode: 'fast',
    latency_tier: 'low',
    cost_tier: 'free',
    privacy_tier: 'local',
    supports_streaming: false,
  },
  {
    id: 3,
    model_key: 'mock-tts-browser',
    display_name: 'Mock Browser TTS',
    capability: 'tts',
    mode: 'fast',
    latency_tier: 'low',
    cost_tier: 'free',
    privacy_tier: 'browser',
    supports_streaming: false,
  },
]
