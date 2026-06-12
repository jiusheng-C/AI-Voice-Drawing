package aihub

import (
	"context"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/commands"
)

type ASRResult struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
	IsFinal    bool    `json:"is_final"`
}

type TTSResult struct {
	Text      string `json:"text"`
	AudioURL  string `json:"audio_url,omitempty"`
	VoiceName string `json:"voice_name"`
}

type ASRProvider interface {
	Transcribe(ctx context.Context, audio []byte) (ASRResult, error)
}

type NLUProvider interface {
	Parse(ctx context.Context, text string) (commands.CommandPlan, error)
}

type TTSProvider interface {
	Speak(ctx context.Context, text string) (TTSResult, error)
}

type Hub struct {
	ASR ASRProvider
	NLU NLUProvider
	TTS TTSProvider
}

func NewMockHub() Hub {
	mock := NewMockProvider()
	return Hub{ASR: mock, NLU: mock, TTS: mock}
}
