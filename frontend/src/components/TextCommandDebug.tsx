import { FormEvent, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { postTextCommand } from '../api/client'

interface TextCommandDebugProps {
  projectId: number
}

export function TextCommandDebug({ projectId }: TextCommandDebugProps) {
  const [text, setText] = useState('画一个蓝色圆形')
  const [result, setResult] = useState('等待调试指令')
  const [isLoading, setIsLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    try {
      const response = await postTextCommand(projectId, text)
      setResult(JSON.stringify(response.command_plan, null, 2))
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Command parser failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className="debug-command" onSubmit={submit}>
      <label htmlFor="debug-command-input">开发调试指令</label>
      <div className="debug-input-row">
        <input
          id="debug-command-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="画一个蓝色圆形"
        />
        <button type="submit" disabled={isLoading} title="发送调试指令">
          <SendHorizontal size={17} />
        </button>
      </div>
      <pre>{result}</pre>
    </form>
  )
}
