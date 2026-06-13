import { useEffect, useMemo, useState } from 'react'
import { fetchAIModels, saveAIPreferences, type AIModel, type RuntimeConfig } from '../api/client'

const capabilities = ['asr', 'nlu', 'tts'] as const

interface ModelCenterPanelProps {
  config: RuntimeConfig
}

export function ModelCenterPanel({ config }: ModelCenterPanelProps) {
  const [models, setModels] = useState<AIModel[]>([])
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [status, setStatus] = useState(config.mockMode ? 'Using local mock models' : 'Loading models from backend')

  useEffect(() => {
    fetchAIModels(config)
      .then((response) => {
        setModels(response.models)
        setSelected(
          Object.fromEntries(
            capabilities.flatMap((capability) => {
              const model = response.models.find((item) => item.capability === capability)
              return model ? [[capability, model.id]] : []
            }),
          ),
        )
        setStatus(config.mockMode ? 'Mock models ready' : 'Backend models ready')
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : 'Model load failed'))
  }, [config])

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        capabilities.map((capability) => [
          capability,
          models.filter((model) => model.capability === capability),
        ]),
      ) as Record<(typeof capabilities)[number], AIModel[]>,
    [models],
  )

  async function save() {
    const preferences = Object.entries(selected).map(([capability, modelId]) => ({
      scenario: capability === 'asr' ? 'asr_realtime' : `${capability}_default`,
      mode: 'fast',
      primary_model_id: modelId,
      fallback_model_ids: [],
    }))
    try {
      await saveAIPreferences(preferences, config)
      setStatus(config.mockMode ? 'Model mode saved locally' : 'Model preferences saved')
    } catch (error) {
      localStorage.setItem('ai_voice_drawing_model_preferences', JSON.stringify(preferences))
      setStatus(error instanceof Error ? `${error.message}; saved locally` : 'Backend save failed; saved locally')
    }
  }

  return (
    <div className="model-center-list">
      {capabilities.map((capability) => (
        <fieldset key={capability}>
          <legend>{capability.toUpperCase()}</legend>
          {grouped[capability].map((model) => (
            <label key={model.id}>
              <input
                checked={selected[capability] === model.id}
                name={capability}
                type="radio"
                onChange={() => setSelected((current) => ({ ...current, [capability]: model.id }))}
              />
              <span>{model.display_name}</span>
              <small>{model.latency_tier} · {model.cost_tier} · {model.privacy_tier}</small>
            </label>
          ))}
        </fieldset>
      ))}
      <button type="button" onClick={save}>Save model mode</button>
      <p>{status}</p>
    </div>
  )
}
