package commands

import (
	"fmt"
	"strings"
)

type RuleParser struct{}

func NewRuleParser() RuleParser {
	return RuleParser{}
}

func (p RuleParser) ParseText(input string) CommandPlan {
	text := normalizeText(input)
	commandID := "cmd_rule"

	if text == "" {
		return unclearPlan(commandID, input, "我没有听清，请再说一遍。")
	}
	if strings.Contains(text, "撤销") {
		return singleStepPlan(commandID, input, CommandUndo, nil, nil, "已识别为撤销上一步。")
	}
	if strings.Contains(text, "重做") || strings.Contains(text, "恢复") {
		return singleStepPlan(commandID, input, CommandRedo, nil, nil, "已识别为重做。")
	}
	if strings.Contains(text, "矩形") || strings.Contains(text, "方形") {
		colorName, colorHex := parseColor(text)
		args := map[string]any{
			"shape":  "rect",
			"fill":   colorHex,
			"x":      640,
			"y":      360,
			"width":  240,
			"height": 150,
		}
		return singleStepPlan(commandID, input, CommandCreateShape, nil, args, fmt.Sprintf("已识别为创建%s矩形。", colorName))
	}
	if strings.Contains(text, "圆") {
		colorName, colorHex := parseColor(text)
		args := map[string]any{
			"shape":  "circle",
			"fill":   colorHex,
			"x":      640,
			"y":      360,
			"radius": 80,
		}
		return singleStepPlan(commandID, input, CommandCreateShape, nil, args, fmt.Sprintf("已识别为创建%s圆形。", colorName))
	}
	if strings.Contains(text, "文字") || strings.Contains(text, "文本") || strings.Contains(text, "写") {
		args := map[string]any{
			"text":      extractQuotedText(input),
			"fill":      "#111827",
			"x":         640,
			"y":         360,
			"font_size": 32,
		}
		return singleStepPlan(commandID, input, CommandCreateText, nil, args, "已识别为创建文字。")
	}
	if strings.Contains(text, "改成") || strings.Contains(text, "变成") || strings.Contains(text, "颜色") {
		colorName, colorHex := parseColor(text)
		target := &CommandTarget{Type: TargetReference, Reference: "last_object"}
		args := map[string]any{"fill": colorHex}
		return singleStepPlan(commandID, input, CommandUpdateObject, target, args, fmt.Sprintf("已识别为把最近对象改成%s。", colorName))
	}
	if strings.Contains(text, "移动") || strings.Contains(text, "向左") || strings.Contains(text, "向右") || strings.Contains(text, "向上") || strings.Contains(text, "向下") {
		target := &CommandTarget{Type: TargetReference, Reference: "last_object"}
		args := parseMoveArgs(text)
		return singleStepPlan(commandID, input, CommandMoveObject, target, args, "已识别为移动最近对象。")
	}

	return unclearPlan(commandID, input, "我还不能确定这条指令，请换一种说法。")
}

func singleStepPlan(commandID string, input string, commandType CommandType, target *CommandTarget, args map[string]any, feedback string) CommandPlan {
	return CommandPlan{
		CommandID:             commandID,
		Source:                "text_debug",
		ASRText:               input,
		Mode:                  PlanModeExecute,
		RequiresConfirmation:  false,
		RequiresClarification: false,
		Confidence:            0.92,
		RiskLevel:             RiskLow,
		Feedback:              feedback,
		Commands: []CommandStep{
			{
				ID:         "step_1",
				Type:       commandType,
				Target:     target,
				Args:       args,
				Risk:       RiskLow,
				Confidence: 0.92,
			},
		},
	}
}

func unclearPlan(commandID string, input string, feedback string) CommandPlan {
	return CommandPlan{
		CommandID:             commandID,
		Source:                "text_debug",
		ASRText:               input,
		Mode:                  PlanModePlan,
		RequiresClarification: true,
		Confidence:            0.35,
		RiskLevel:             RiskLow,
		Feedback:              feedback,
		Commands:              []CommandStep{},
	}
}

func normalizeText(input string) string {
	replacer := strings.NewReplacer(" ", "", "，", ",", "。", ".", "！", "!", "？", "?")
	return strings.ToLower(replacer.Replace(strings.TrimSpace(input)))
}

func parseColor(text string) (string, string) {
	colors := []struct {
		Name string
		Hex  string
		Keys []string
	}{
		{Name: "蓝色", Hex: "#2563eb", Keys: []string{"蓝色", "蓝"}},
		{Name: "红色", Hex: "#dc2626", Keys: []string{"红色", "红"}},
		{Name: "绿色", Hex: "#16a34a", Keys: []string{"绿色", "绿"}},
		{Name: "黄色", Hex: "#facc15", Keys: []string{"黄色", "黄"}},
		{Name: "黑色", Hex: "#111827", Keys: []string{"黑色", "黑"}},
		{Name: "白色", Hex: "#ffffff", Keys: []string{"白色", "白"}},
	}
	for _, color := range colors {
		for _, key := range color.Keys {
			if strings.Contains(text, key) {
				return color.Name, color.Hex
			}
		}
	}
	return "蓝色", "#2563eb"
}

func parseMoveArgs(text string) map[string]any {
	dx := 0
	dy := 0
	if strings.Contains(text, "向左") {
		dx = -40
	}
	if strings.Contains(text, "向右") {
		dx = 40
	}
	if strings.Contains(text, "向上") {
		dy = -40
	}
	if strings.Contains(text, "向下") {
		dy = 40
	}
	if dx == 0 && dy == 0 {
		dx = 40
	}
	return map[string]any{"dx": dx, "dy": dy}
}

func extractQuotedText(input string) string {
	for _, pair := range [][2]string{{"“", "”"}, {"\"", "\""}, {"'", "'"}} {
		start := strings.Index(input, pair[0])
		end := strings.LastIndex(input, pair[1])
		if start >= 0 && end > start {
			return input[start+len(pair[0]) : end]
		}
	}
	return "文字"
}
