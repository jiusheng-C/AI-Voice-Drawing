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
  const target = createTarget(normalized)
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

  if (normalized.includes('导出') || normalized.includes('png') || normalized.includes('PNG')) {
    return {
      ...base,
      feedback: '已准备导出 PNG。',
      commands: [mockStep('export_project', { format: 'png' })],
    }
  }

  if (normalized.includes('清空') || normalized.includes('新建画布')) {
    return {
      ...base,
      feedback: '已清空画布。',
      commands: [mockStep('create_canvas', { width: 1280, height: 720, clear: true })],
    }
  }

  if (normalized.includes('取消分组') || normalized.includes('解组')) {
    return {
      ...base,
      feedback: '已取消当前分组。',
      commands: [mockStep('ungroup_objects', undefined, { type: 'reference', reference: 'selected_object' })],
    }
  }

  if (normalized.includes('分组') || normalized.includes('组合')) {
    return {
      ...base,
      feedback: '已将画布对象分组。',
      commands: [mockStep('group_objects')],
    }
  }

  if (normalized.includes('图片') || normalized.includes('插图') || normalized.includes('占位图')) {
    return {
      ...base,
      feedback: '已创建图片占位。',
      commands: [
        mockStep('create_shape', {
          shape: 'image_placeholder',
          fill: '#e2e8f0',
          stroke: '#64748b',
          x: 640,
          y: 360,
          width: 260,
          height: 170,
          text: '图片占位',
        }),
      ],
    }
  }

  if (normalized.includes('便签') || normalized.includes('便利贴')) {
    return {
      ...base,
      feedback: '已创建便签。',
      commands: [
        mockStep('create_shape', {
          shape: 'sticky',
          fill: '#fde68a',
          stroke: '#f59e0b',
          x: 640,
          y: 360,
          width: 220,
          height: 160,
          text: '便签',
        }),
      ],
    }
  }

  if (normalized.includes('流程节点') || normalized.includes('流程框') || normalized.includes('节点')) {
    return {
      ...base,
      feedback: '已创建流程节点。',
      commands: [
        mockStep('create_shape', {
          shape: 'process',
          fill: color.hex,
          text: '流程节点',
          text_fill: '#ffffff',
          x: 640,
          y: 360,
          width: 260,
          height: 120,
        }),
      ],
    }
  }

  if (normalized.includes('三角形')) {
    return {
      ...base,
      feedback: `已创建${color.name}三角形。`,
      commands: [
        mockStep('create_shape', {
          shape: 'triangle',
          fill: color.hex,
          x: 640,
          y: 360,
          width: 180,
          height: 160,
        }),
      ],
    }
  }

  if (normalized.includes('菱形')) {
    return {
      ...base,
      feedback: `已创建${color.name}菱形。`,
      commands: [
        mockStep('create_shape', {
          shape: 'diamond',
          fill: color.hex,
          x: 640,
          y: 360,
          width: 200,
          height: 160,
        }),
      ],
    }
  }

  if (normalized.includes('星形') || normalized.includes('五角星')) {
    return {
      ...base,
      feedback: `已创建${color.name}星形。`,
      commands: [
        mockStep('create_shape', {
          shape: 'star',
          fill: color.hex,
          x: 640,
          y: 360,
          radius: 86,
        }),
      ],
    }
  }

  if (normalized.includes('复制') || normalized.includes('副本')) {
    return {
      ...base,
      feedback: '已复制当前对象。',
      commands: [mockStep('ungroup_objects', undefined, { type: 'reference', reference: 'selected_object' })],
    }
  }

  if (normalized.includes('删除') || normalized.includes('移除')) {
    return {
      ...base,
      feedback: '已删除当前对象。',
      commands: [mockStep('delete_object', undefined, target)],
    }
  }

  if (normalized.includes('选择') || normalized.includes('选中')) {
    return {
      ...base,
      feedback: '已选择匹配对象。',
      commands: [mockStep('select_object', undefined, target)],
    }
  }

  if (normalized.includes('椭圆')) {
    return {
      ...base,
      feedback: `已创建${color.name}椭圆。`,
      commands: [
        mockStep('create_shape', {
          shape: 'ellipse',
          fill: color.hex,
          x: 640,
          y: 360,
          width: 260,
          height: 150,
          rx: 130,
          ry: 75,
        }),
      ],
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

  if (normalized.includes('箭头')) {
    return {
      ...base,
      feedback: `已创建${color.name}箭头。`,
      commands: [
        mockStep('create_shape', {
          shape: 'arrow',
          stroke: color.hex,
          x: 640,
          y: 360,
          width: 280,
          stroke_width: 5,
        }),
      ],
    }
  }

  if (normalized.includes('线条') || normalized.includes('直线') || normalized.includes('线段')) {
    return {
      ...base,
      feedback: `已创建${color.name}线条。`,
      commands: [
        mockStep('create_shape', {
          shape: 'line',
          stroke: color.hex,
          x: 640,
          y: 360,
          width: 260,
          stroke_width: 5,
        }),
      ],
    }
  }

  if (normalized.includes('文字') || normalized.includes('文本') || normalized.includes('写')) {
    return {
      ...base,
      feedback: '已创建文字。',
      commands: [
        mockStep('create_text', {
          text: extractText(text),
          fill: color.hex,
          x: 640,
          y: 360,
          font_size: normalized.includes('大') ? 44 : 32,
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
          target,
        ),
      ],
    }
  }

  if (normalized.includes('边框') || normalized.includes('描边')) {
    return {
      ...base,
      feedback: `已把边框改成${color.name}。`,
      commands: [mockStep('update_object', { stroke: color.hex, stroke_width: 4 }, target)],
    }
  }

  if (normalized.includes('透明')) {
    return {
      ...base,
      feedback: '已调整对象透明度。',
      commands: [mockStep('update_object', { opacity: normalized.includes('不透明') ? 1 : 0.45 }, target)],
    }
  }

  if (normalized.includes('放大') || normalized.includes('缩小') || normalized.includes('变大') || normalized.includes('变小')) {
    return {
      ...base,
      feedback: normalized.includes('缩小') || normalized.includes('变小') ? '已缩小当前对象。' : '已放大当前对象。',
      commands: [mockStep('resize_object', { scale: normalized.includes('缩小') || normalized.includes('变小') ? 0.75 : 1.25 }, target)],
    }
  }

  if (normalized.includes('旋转')) {
    return {
      ...base,
      feedback: '已旋转当前对象。',
      commands: [mockStep('rotate_object', { angle: normalized.includes('逆') ? -15 : 15 }, target)],
    }
  }

  if (normalized.includes('置顶') || normalized.includes('最上层') || normalized.includes('前移')) {
    return {
      ...base,
      feedback: '已将对象置顶。',
      commands: [mockStep('arrange_object', { position: 'front' }, target)],
    }
  }

  if (normalized.includes('置底') || normalized.includes('最下层') || normalized.includes('后移')) {
    return {
      ...base,
      feedback: '已将对象置底。',
      commands: [mockStep('arrange_object', { position: 'back' }, target)],
    }
  }

  if (normalized.includes('移动') || normalized.includes('向左') || normalized.includes('向右') || normalized.includes('向上') || normalized.includes('向下')) {
    return {
      ...base,
      feedback: '已移动当前对象。',
      commands: [mockStep('move_object', parseMove(normalized), target)],
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
  target?: { type: TargetType; reference?: string; object_type?: string; color?: string },
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

function createTarget(text: string): { type: TargetType; reference?: string; object_type?: string; color?: string } {
  const shape = parseShapeType(text)
  if (shape) {
    return { type: 'query', object_type: shape }
  }
  if (text.includes('最后') || text.includes('刚才') || text.includes('最近') || text.includes('它')) {
    return { type: 'reference', reference: 'last_object' }
  }
  return { type: 'reference', reference: 'selected_object' }
}

function parseShapeType(text: string) {
  if (text.includes('矩形') || text.includes('方形')) return 'rect'
  if (text.includes('椭圆')) return 'ellipse'
  if (text.includes('圆')) return 'circle'
  if (text.includes('箭头')) return 'arrow'
  if (text.includes('线')) return 'line'
  if (text.includes('三角形')) return 'triangle'
  if (text.includes('菱形')) return 'diamond'
  if (text.includes('星形') || text.includes('五角星')) return 'star'
  if (text.includes('便签') || text.includes('便利贴')) return 'sticky'
  if (text.includes('流程节点') || text.includes('流程框') || text.includes('节点')) return 'process'
  if (text.includes('图片') || text.includes('插图') || text.includes('占位图')) return 'image_placeholder'
  if (text.includes('分组') || text.includes('组合')) return 'group'
  if (text.includes('文字') || text.includes('文本')) return 'text'
  return ''
}

function parseMove(text: string) {
  const move = {
    dx: text.includes('向左') ? -40 : text.includes('向右') ? 40 : 0,
    dy: text.includes('向上') ? -40 : text.includes('向下') ? 40 : 0,
  }
  if (move.dx === 0 && move.dy === 0) {
    move.dx = 40
  }
  return move
}

function extractText(text: string) {
  const quoted = text.match(/[“"](.+?)[”"]/)
  if (quoted?.[1]) {
    return quoted[1]
  }
  const writeIndex = text.indexOf('写')
  if (writeIndex >= 0 && writeIndex < text.length - 1) {
    return text.slice(writeIndex + 1).replace(/[，。,.]/g, '').trim() || '文字'
  }
  return '文字'
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
