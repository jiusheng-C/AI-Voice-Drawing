package aihub

import (
	"context"
	"testing"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/commands"
)

func TestMockProviderCompletesASRNLUTTSLoop(t *testing.T) {
	provider := NewMockProvider()
	ctx := context.Background()

	asr, err := provider.Transcribe(ctx, []byte("画一个蓝色圆形"))
	if err != nil {
		t.Fatalf("transcribe: %v", err)
	}
	if asr.Text != "画一个蓝色圆形" || !asr.IsFinal {
		t.Fatalf("unexpected ASR result %#v", asr)
	}

	plan, err := provider.Parse(ctx, asr.Text)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(plan.Commands) != 1 || plan.Commands[0].Type != commands.CommandCreateShape {
		t.Fatalf("unexpected command plan %#v", plan)
	}

	tts, err := provider.Speak(ctx, plan.Feedback)
	if err != nil {
		t.Fatalf("speak: %v", err)
	}
	if tts.Text == "" || tts.VoiceName != "mock-browser-tts" {
		t.Fatalf("unexpected TTS result %#v", tts)
	}
}

func TestMockProviderKeepsEmptyTranscriptEmpty(t *testing.T) {
	provider := NewMockProvider()
	asr, err := provider.Transcribe(context.Background(), nil)
	if err != nil {
		t.Fatalf("transcribe empty audio: %v", err)
	}
	if asr.Text != "" {
		t.Fatalf("empty audio should not become a default command: %#v", asr)
	}
}
