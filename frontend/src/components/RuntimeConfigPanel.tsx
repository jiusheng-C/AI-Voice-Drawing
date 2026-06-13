import { Settings } from 'lucide-react'
import type { RuntimeConfig } from '../api/client'

interface RuntimeConfigPanelProps {
  config: RuntimeConfig
  onChange: (config: RuntimeConfig) => void
}

export function RuntimeConfigPanel({ config, onChange }: RuntimeConfigPanelProps) {
  return (
    <section className="runtime-config" aria-label="Runtime connection settings">
      <div className="panel-title">
        <Settings size={17} />
        <span>连接配置</span>
      </div>
      <label className="toggle-row">
        <input
          checked={config.mockMode}
          type="checkbox"
          onChange={(event) => onChange({ ...config, mockMode: event.target.checked })}
        />
        <span>使用本地 mock 演示</span>
      </label>
      <label>
        <span>后端 API</span>
        <input
          value={config.apiBaseUrl}
          onChange={(event) => onChange({ ...config, apiBaseUrl: event.target.value.trim() })}
        />
      </label>
      <label>
        <span>语音 WebSocket</span>
        <input
          value={config.wsBaseUrl}
          onChange={(event) => onChange({ ...config, wsBaseUrl: event.target.value.trim() })}
        />
      </label>
    </section>
  )
}
