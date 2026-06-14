import { useEffect, useMemo, useState } from 'react'
import { fetchAIModels, saveAIPreferences, saveLocalAIModel, type AIModel, type RuntimeConfig } from '../api/client'

const capabilities = ['asr', 'nlu', 'tts'] as const
const capabilityLabels: Record<(typeof capabilities)[number], string> = {
  asr: 'ASR 语音识别',
  nlu: 'NLU/LLM 指令理解',
  tts: 'TTS 语音反馈',
}

interface ModelCenterPanelProps {
  config: RuntimeConfig
}

export function ModelCenterPanel({ config }: ModelCenterPanelProps) {
  const [models, setModels] = useState<AIModel[]>([])
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [status, setStatus] = useState(config.mockMode ? '正在使用本地 mock 模型' : '正在从后端加载模型')
  const [customModel, setCustomModel] = useState({
    display_name: '',
    capability: 'nlu' as (typeof capabilities)[number],
    mode: 'custom',
    endpoint_url: '',
    model_key: '',
    api_key: '',
  })

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
        setStatus(config.mockMode ? '本地和自定义模型已就绪' : '后端模型已就绪')
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : '模型加载失败'))
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
      mode: models.find((model) => model.id === modelId)?.mode ?? 'custom',
      primary_model_id: modelId,
      fallback_model_ids: [],
    }))
    try {
      await saveAIPreferences(preferences, config)
      setStatus(config.mockMode ? '模型模式已保存到本地' : '模型偏好已保存')
    } catch (error) {
      localStorage.setItem('ai_voice_drawing_model_preferences', JSON.stringify(preferences))
      setStatus(error instanceof Error ? `${error.message}；已保存到本地` : '后端保存失败；已保存到本地')
    }
  }

  function addCustomModel() {
    if (!customModel.display_name.trim() || !customModel.endpoint_url.trim() || !customModel.model_key.trim()) {
      setStatus('请填写模型名称、接口地址和模型 ID。')
      return
    }
    const model = saveLocalAIModel({
      display_name: customModel.display_name.trim(),
      capability: customModel.capability,
      mode: customModel.mode.trim() || 'custom',
      endpoint_url: customModel.endpoint_url.trim(),
      model_key: customModel.model_key.trim(),
      api_key: customModel.api_key.trim(),
    })
    setModels((current) => [...current.filter((item) => item.model_key !== model.model_key), model])
    setSelected((current) => ({ ...current, [model.capability]: model.id }))
    setCustomModel((current) => ({ ...current, display_name: '', endpoint_url: '', model_key: '', api_key: '' }))
    setStatus('自定义模型已添加到本地列表；保存模型模式后会作为当前偏好。')
  }

  return (
    <div className="model-center-list">
      <p className="model-center-note">
        当前 MVP 默认使用 mock provider 保证本地闭环。你可以在这里登记 OpenAI 兼容接口、自建网关或私有模型；本 PR 先保存配置和选择，真实外部调用需要后端代理接入，API Key 不会写入代码。
      </p>
      <div className="model-center-guide">
        <strong>接入说明</strong>
        <span>ASR 填语音转文字接口，NLU/LLM 填把自然语言转绘图命令的接口，TTS 填语音播报接口。</span>
        <span>接口地址建议填写到版本根路径，例如 https://api.example.com/v1；模型 ID 填供应商或网关实际识别的模型名。</span>
        <span>当前版本会把模型配置保存在本浏览器，把 API Key 临时保存在当前会话；生产接入应由 Go 后端加密保存密钥并统一代理调用。</span>
      </div>
      {capabilities.map((capability) => (
        <fieldset key={capability}>
          <legend>{capabilityLabels[capability]}</legend>
          {grouped[capability].map((model) => (
            <label key={model.id}>
              <input
                checked={selected[capability] === model.id}
                name={capability}
                type="radio"
                onChange={() => setSelected((current) => ({ ...current, [capability]: model.id }))}
              />
              <span>{model.display_name}</span>
              <small>
                {model.mode} · {model.latency_tier} · {model.cost_tier} · {model.privacy_tier}
                {model.endpoint_url ? ` · ${model.endpoint_url}` : ''}
              </small>
              {model.description ? <small>{model.description}</small> : null}
            </label>
          ))}
        </fieldset>
      ))}
      <fieldset className="custom-model-form">
        <legend>接入自定义模型</legend>
        <label>
          能力类型
          <select
            value={customModel.capability}
            onChange={(event) => setCustomModel((current) => ({ ...current, capability: event.target.value as (typeof capabilities)[number] }))}
          >
            <option value="asr">ASR 语音识别</option>
            <option value="nlu">NLU/LLM 指令理解</option>
            <option value="tts">TTS 语音反馈</option>
          </select>
        </label>
        <label>
          显示名称
          <input
            placeholder="例如：我的低延迟 ASR"
            value={customModel.display_name}
            onChange={(event) => setCustomModel((current) => ({ ...current, display_name: event.target.value }))}
          />
        </label>
        <label>
          接口地址
          <input
            placeholder="https://api.example.com/v1"
            value={customModel.endpoint_url}
            onChange={(event) => setCustomModel((current) => ({ ...current, endpoint_url: event.target.value }))}
          />
        </label>
        <label>
          模型 ID
          <input
            placeholder="例如：gpt-4.1-mini / whisper-large-v3"
            value={customModel.model_key}
            onChange={(event) => setCustomModel((current) => ({ ...current, model_key: event.target.value }))}
          />
        </label>
        <label>
          模式
          <select
            value={customModel.mode}
            onChange={(event) => setCustomModel((current) => ({ ...current, mode: event.target.value }))}
          >
            <option value="fast">快速</option>
            <option value="accurate">准确</option>
            <option value="private">隐私</option>
            <option value="low_cost">低成本</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <label>
          API Key 或网关令牌
          <input
            placeholder="仅保存在当前浏览器会话"
            type="password"
            value={customModel.api_key}
            onChange={(event) => setCustomModel((current) => ({ ...current, api_key: event.target.value }))}
          />
        </label>
        <button type="button" onClick={addCustomModel}>添加到模型列表</button>
        <p>建议生产环境通过后端加密存储密钥，由 Go 服务代理调用外部模型，前端不直接暴露密钥。</p>
      </fieldset>
      <button type="button" onClick={save}>保存模型模式</button>
      <p>{status}</p>
    </div>
  )
}
