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

func firstStep(t *testing.T, plan CommandPlan) CommandStep {
	t.Helper()
	if len(plan.Commands) != 1 {
		t.Fatalf("expected one command, got %d", len(plan.Commands))
	}
	return plan.Commands[0]
}
