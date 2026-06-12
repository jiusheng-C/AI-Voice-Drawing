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
