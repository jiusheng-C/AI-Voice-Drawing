const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export async function postTextCommand(projectId: number, text: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/text-commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error(`Command parser failed with status ${response.status}`)
  }

  return (await response.json()) as { command_plan: unknown }
}

export async function saveCanvasState(projectId: number, state: unknown) {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/canvas-state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })

  if (!response.ok) {
    throw new Error(`Canvas sync failed with status ${response.status}`)
  }

  return response.json()
}

export async function fetchAIModels() {
  const response = await fetch(`${API_BASE_URL}/api/v1/ai/models`)
  if (!response.ok) {
    throw new Error(`Model list failed with status ${response.status}`)
  }
  return (await response.json()) as { models: AIModel[] }
}

export async function saveAIPreferences(preferences: unknown[]) {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/me/ai-preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  })
  if (!response.ok) {
    throw new Error(`Preference save failed with status ${response.status}`)
  }
  return response.json()
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
