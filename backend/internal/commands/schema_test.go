package commands

import (
	"encoding/json"
	"testing"
)

func TestCommandPlanJSON(t *testing.T) {
	plan := CommandPlan{
		CommandID:  "cmd_001",
		Source:     "text_debug",
		ASRText:    "画一个蓝色圆形",
		Mode:       PlanModeExecute,
		Confidence: 0.95,
		RiskLevel:  RiskLow,
		Feedback:   "已识别为创建蓝色圆形。",
		Commands: []CommandStep{
			{
				ID:   "step_1",
				Type: CommandCreateShape,
				Args: map[string]any{
					"shape": "circle",
					"fill":  "#2563eb",
				},
				Risk:       RiskLow,
				Confidence: 0.95,
			},
		},
	}

	data, err := json.Marshal(plan)
	if err != nil {
		t.Fatalf("marshal command plan: %v", err)
	}

	var decoded CommandPlan
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal command plan: %v", err)
	}
	if decoded.Commands[0].Type != CommandCreateShape {
		t.Fatalf("unexpected command type %q", decoded.Commands[0].Type)
	}
}
