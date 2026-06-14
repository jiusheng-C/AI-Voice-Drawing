package commands

import "testing"

func TestRuleParserCreateBlueCircle(t *testing.T) {
	plan := NewRuleParser().ParseText("画一个蓝色圆形")
	step := firstStep(t, plan)
	if step.Type != CommandCreateShape {
		t.Fatalf("expected create_shape, got %s", step.Type)
	}
	if step.Args["shape"] != "circle" || step.Args["fill"] != "#2563eb" {
		t.Fatalf("unexpected args %#v", step.Args)
	}
}

func TestRuleParserCreateRedRect(t *testing.T) {
	plan := NewRuleParser().ParseText("画一个红色矩形")
	step := firstStep(t, plan)
	if step.Args["shape"] != "rect" || step.Args["fill"] != "#dc2626" {
		t.Fatalf("unexpected args %#v", step.Args)
	}
}

func TestRuleParserUpdateLastObjectGreen(t *testing.T) {
	plan := NewRuleParser().ParseText("把它改成绿色")
	step := firstStep(t, plan)
	if step.Type != CommandUpdateObject {
		t.Fatalf("expected update_object, got %s", step.Type)
	}
	if step.Target == nil || step.Target.Reference != "last_object" {
		t.Fatalf("unexpected target %#v", step.Target)
	}
	if step.Args["fill"] != "#16a34a" {
		t.Fatalf("unexpected args %#v", step.Args)
	}
}

func TestRuleParserUndo(t *testing.T) {
	plan := NewRuleParser().ParseText("撤销")
	step := firstStep(t, plan)
	if step.Type != CommandUndo {
		t.Fatalf("expected undo, got %s", step.Type)
	}
}

func TestRuleParserCreateEllipseAndArrow(t *testing.T) {
	ellipse := firstStep(t, NewRuleParser().ParseText("画一个绿色椭圆"))
	if ellipse.Type != CommandCreateShape || ellipse.Args["shape"] != "ellipse" || ellipse.Args["fill"] != "#16a34a" {
		t.Fatalf("unexpected ellipse step %#v", ellipse)
	}

	arrow := firstStep(t, NewRuleParser().ParseText("画一条黑色箭头"))
	if arrow.Type != CommandCreateShape || arrow.Args["shape"] != "arrow" || arrow.Args["stroke"] != "#111827" {
		t.Fatalf("unexpected arrow step %#v", arrow)
	}
}

func TestRuleParserObjectOperations(t *testing.T) {
	cases := []struct {
		name string
		text string
		want CommandType
	}{
		{name: "delete", text: "删除当前对象", want: CommandDeleteObject},
		{name: "resize", text: "放大当前对象", want: CommandResizeObject},
		{name: "rotate", text: "旋转当前对象", want: CommandRotateObject},
		{name: "front", text: "置顶当前对象", want: CommandArrangeObject},
		{name: "export", text: "导出 PNG", want: CommandExportProject},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			step := firstStep(t, NewRuleParser().ParseText(tc.text))
			if step.Type != tc.want {
				t.Fatalf("expected %s, got %s", tc.want, step.Type)
			}
		})
	}
}

func firstStep(t *testing.T, plan CommandPlan) CommandStep {
	t.Helper()
	if len(plan.Commands) != 1 {
		t.Fatalf("expected one command, got %d", len(plan.Commands))
	}
	return plan.Commands[0]
}
