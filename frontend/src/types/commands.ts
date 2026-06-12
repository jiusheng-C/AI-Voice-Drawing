export type PlanMode = 'execute' | 'plan'

export type CommandType =
  | 'create_canvas'
  | 'create_shape'
  | 'create_text'
  | 'select_object'
  | 'update_object'
  | 'move_object'
  | 'resize_object'
  | 'rotate_object'
  | 'arrange_object'
  | 'group_objects'
  | 'ungroup_objects'
  | 'delete_object'
  | 'undo'
  | 'redo'
  | 'export_project'
  | 'switch_model'
  | 'summarize_canvas'

export type RiskLevel = 'low' | 'medium' | 'high'

export type TargetType = 'reference' | 'query' | 'explicit_id'

export interface CommandPlan {
  command_id: string
  source: string
  asr_text?: string
  mode: PlanMode
  commands: CommandStep[]
  requires_confirmation: boolean
  requires_clarification: boolean
  confidence: number
  risk_level: RiskLevel
  feedback: string
}

export interface CommandStep {
  id: string
  type: CommandType
  target?: CommandTarget
  args?: Record<string, unknown>
  depends_on?: string[]
  risk: RiskLevel
  confidence: number
}

export interface CommandTarget {
  type: TargetType
  reference?: string
  object_id?: string
  object_type?: string
  color?: string
  position?: string
}
