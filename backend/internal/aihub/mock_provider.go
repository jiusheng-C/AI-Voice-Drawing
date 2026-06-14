package aihub

import (
	"context"
	"strings"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/commands"
)

type MockProvider struct {
	parser commands.RuleParser
}

func NewMockProvider() MockProvider {
	return MockProvider{parser: commands.NewRuleParser()}
}

func (p MockProvider) Transcribe(ctx context.Context, audio []byte) (ASRResult, error) {
	select {
	case <-ctx.Done():
		return ASRResult{}, ctx.Err()
	default:
	}

	text := strings.TrimSpace(string(audio))
	return ASRResult{Text: text, Confidence: 0.99, IsFinal: true}, nil
}

func (p MockProvider) Parse(ctx context.Context, text string) (commands.CommandPlan, error) {
	select {
	case <-ctx.Done():
		return commands.CommandPlan{}, ctx.Err()
	default:
	}
	return p.parser.ParseText(text), nil
}

func (p MockProvider) Speak(ctx context.Context, text string) (TTSResult, error) {
	select {
	case <-ctx.Done():
		return TTSResult{}, ctx.Err()
	default:
	}
	return TTSResult{Text: text, VoiceName: "mock-browser-tts"}, nil
}
