import { FormEvent, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { postTextCommand, type RuntimeConfig } from '../api/client'
import type { CommandPlan } from '../types/commands'

const examples = [
  '画一个蓝色圆形',
  '画一个红色矩形',
  '画一个绿色椭圆',
  '画一条黑色箭头',
  '写“开始处理”',
  '把它改成绿色',
  '把边框改成红色',
  '向右移动',
  '放大当前对象',
  '旋转当前对象',
  '复制当前对象',
  '删除当前对象',
  '置顶当前对象',
  '清空画布',
]

interface TextCommandDebugProps {
  config: RuntimeConfig
  projectId: number
  onPlan: (plan: CommandPlan) => Promise<void> | void
}

export function TextCommandDebug({ config, projectId, onPlan }: TextCommandDebugProps) {
  const [text, setText] = useState('画一个蓝色圆形')
  const [result, setResult] = useState('等待调试指令')
  const [isLoading, setIsLoading] = useState(false)

  async function runCommand(commandText: string) {
    setIsLoading(true)
    try {
      const response = await postTextCommand(projectId, commandText, config)
      const plan = response.command_plan as CommandPlan
      await onPlan(plan)
      setResult(JSON.stringify(plan, null, 2))
    } catch (error) {
      setResult(error instanceof Error ? error.message : '指令解析失败')
    } finally {
      setIsLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runCommand(text)
  }

  return (
    <form className="debug-command" onSubmit={submit}>
      <label htmlFor="debug-command-input">文本指令调试</label>
      <div className="debug-input-row">
        <input
          id="debug-command-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="例如：画一个蓝色圆形"
        />
        <button type="submit" disabled={isLoading} title="发送调试指令">
          <SendHorizontal size={17} />
        </button>
      </div>
      <div className="example-command-list" aria-label="常用调试指令">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setText(example)
              void runCommand(example)
            }}
          >
            {example}
          </button>
        ))}
      </div>
      <pre>{result}</pre>
    </form>
  )
}
