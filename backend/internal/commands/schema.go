package commands

type PlanMode string

const (
	PlanModeExecute PlanMode = "execute"
	PlanModePlan    PlanMode = "plan"
)

type CommandType string

const (
	CommandCreateCanvas    CommandType = "create_canvas"
	CommandCreateShape     CommandType = "create_shape"
	CommandCreateText      CommandType = "create_text"
	CommandSelectObject    CommandType = "select_object"
	CommandUpdateObject    CommandType = "update_object"
	CommandMoveObject      CommandType = "move_object"
	CommandResizeObject    CommandType = "resize_object"
	CommandRotateObject    CommandType = "rotate_object"
	CommandArrangeObject   CommandType = "arrange_object"
	CommandGroupObjects    CommandType = "group_objects"
	CommandUngroupObjects  CommandType = "ungroup_objects"
	CommandDeleteObject    CommandType = "delete_object"
	CommandUndo            CommandType = "undo"
	CommandRedo            CommandType = "redo"
	CommandExportProject   CommandType = "export_project"
	CommandSwitchModel     CommandType = "switch_model"
	CommandSummarizeCanvas CommandType = "summarize_canvas"
)

type RiskLevel string

const (
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
)

type TargetType string

const (
	TargetReference  TargetType = "reference"
	TargetQuery      TargetType = "query"
	TargetExplicitID TargetType = "explicit_id"
)

type CommandPlan struct {
	CommandID             string        `json:"command_id"`
	Source                string        `json:"source"`
	ASRText               string        `json:"asr_text,omitempty"`
	Mode                  PlanMode      `json:"mode"`
	Commands              []CommandStep `json:"commands"`
	RequiresConfirmation  bool          `json:"requires_confirmation"`
	RequiresClarification bool          `json:"requires_clarification"`
	Confidence            float64       `json:"confidence"`
	RiskLevel             RiskLevel     `json:"risk_level"`
	Feedback              string        `json:"feedback"`
}

type CommandStep struct {
	ID         string         `json:"id"`
	Type       CommandType    `json:"type"`
	Target     *CommandTarget `json:"target,omitempty"`
	Args       map[string]any `json:"args,omitempty"`
	DependsOn  []string       `json:"depends_on,omitempty"`
	Risk       RiskLevel      `json:"risk"`
	Confidence float64        `json:"confidence"`
}

type CommandTarget struct {
	Type       TargetType `json:"type"`
	Reference  string     `json:"reference,omitempty"`
	ObjectID   string     `json:"object_id,omitempty"`
	ObjectType string     `json:"object_type,omitempty"`
	Color      string     `json:"color,omitempty"`
	Position   string     `json:"position,omitempty"`
}
