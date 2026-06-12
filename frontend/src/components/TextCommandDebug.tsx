import { FormEvent, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { postTextCommand } from '../api/client'
import type { CommandPlan } from '../types/commands'

interface TextCommandDebugProps {
  projectId: number
  onPlan: (plan: CommandPlan) => Promise<void> | void
}

export function TextCommandDebug({ projectId, onPlan }: TextCommandDebugProps) {
  const [text, setText] = useState('画一个蓝色圆形')
  const [result, setResult] = useState('Waiting for a debug command')
  const [isLoading, setIsLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    try {
      const response = await postTextCommand(projectId, text)
      const plan = response.command_plan as CommandPlan
      await onPlan(plan)
      setResult(JSON.stringify(plan, null, 2))
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Command parser failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className="debug-command" onSubmit={submit}>
      <label htmlFor="debug-command-input">Debug command</label>
      <div className="debug-input-row">
        <input
          id="debug-command-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="画一个蓝色圆形"
        />
        <button type="submit" disabled={isLoading} title="Send debug command">
          <SendHorizontal size={17} />
        </button>
      </div>
      <pre>{result}</pre>
    </form>
  )
}
