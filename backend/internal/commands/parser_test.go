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

func TestRuleParserCreateAdditionalShapes(t *testing.T) {
	cases := []struct {
		name  string
		text  string
		shape string
	}{
		{name: "triangle", text: "画一个黄色三角形", shape: "triangle"},
		{name: "diamond", text: "画一个蓝色菱形", shape: "diamond"},
		{name: "star", text: "画一个红色五角星", shape: "star"},
		{name: "sticky", text: "创建一个便签", shape: "sticky"},
		{name: "process", text: "创建一个流程节点", shape: "process"},
		{name: "image", text: "创建一个图片占位", shape: "image_placeholder"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			step := firstStep(t, NewRuleParser().ParseText(tc.text))
			if step.Type != CommandCreateShape || step.Args["shape"] != tc.shape {
				t.Fatalf("unexpected shape step %#v", step)
			}
		})
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
		{name: "group", text: "把所有对象分组", want: CommandGroupObjects},
		{name: "ungroup", text: "取消分组", want: CommandUngroupObjects},
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

func TestRuleParserLayoutOperations(t *testing.T) {
	cases := []struct {
		name     string
		text     string
		position string
	}{
		{name: "align left", text: "所有对象左对齐", position: "align_left"},
		{name: "align center x", text: "所有对象水平居中", position: "align_center_x"},
		{name: "align top", text: "所有对象顶端对齐", position: "align_top"},
		{name: "distribute horizontal", text: "所有对象水平等距分布", position: "distribute_horizontal"},
		{name: "distribute vertical", text: "所有对象垂直等距分布", position: "distribute_vertical"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			step := firstStep(t, NewRuleParser().ParseText(tc.text))
			if step.Type != CommandArrangeObject {
				t.Fatalf("expected arrange_object, got %s", step.Type)
			}
			if step.Args["position"] != tc.position {
				t.Fatalf("expected position %s, got %#v", tc.position, step.Args["position"])
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
