package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/aihub"
)

type voiceWSHandler struct {
	hub aihub.Hub
}

type voiceClientEvent struct {
	Type  string `json:"type"`
	Text  string `json:"text,omitempty"`
	Audio string `json:"audio,omitempty"`
}

type voiceServerEvent struct {
	Type       string  `json:"type"`
	Text       string  `json:"text,omitempty"`
	Confidence float64 `json:"confidence,omitempty"`
	IsFinal    bool    `json:"is_final,omitempty"`
	Plan       any     `json:"command_plan,omitempty"`
	Feedback   string  `json:"feedback,omitempty"`
	Error      string  `json:"error,omitempty"`
}

var voiceUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func RegisterVoiceWSRoutes(router *gin.Engine, hub aihub.Hub) {
	handler := voiceWSHandler{hub: hub}
	router.GET("/api/v1/projects/:id/voice-stream", handler.stream)
}

func (h voiceWSHandler) stream(ctx *gin.Context) {
	if _, ok := parseProjectID(ctx); !ok {
		return
	}

	conn, err := voiceUpgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	if err := conn.WriteJSON(voiceServerEvent{Type: "ready", Feedback: "语音通道已连接。"}); err != nil {
		return
	}

	for {
		var event voiceClientEvent
		if err := conn.ReadJSON(&event); err != nil {
			return
		}

		switch event.Type {
		case "audio_chunk", "voice_end", "text":
			text := event.Text
			if text == "" {
				text = event.Audio
			}
			if text == "" {
				text = "画一个蓝色圆形"
			}
			if err := h.handleUtterance(ctx, conn, text); err != nil {
				_ = conn.WriteJSON(voiceServerEvent{Type: "error", Error: err.Error()})
				return
			}
		default:
			_ = conn.WriteJSON(voiceServerEvent{Type: "error", Error: "unsupported voice event type"})
		}
	}
}

func (h voiceWSHandler) handleUtterance(ctx *gin.Context, conn *websocket.Conn, text string) error {
	asr, err := h.hub.ASR.Transcribe(ctx.Request.Context(), []byte(text))
	if err != nil {
		return err
	}
	if err := conn.WriteJSON(voiceServerEvent{Type: "asr_partial", Text: asr.Text, Confidence: asr.Confidence, IsFinal: asr.IsFinal}); err != nil {
		return err
	}

	plan, err := h.hub.NLU.Parse(ctx.Request.Context(), asr.Text)
	if err != nil {
		return err
	}
	planBytes, err := json.Marshal(plan)
	if err != nil {
		return err
	}
	var planValue any
	if err := json.Unmarshal(planBytes, &planValue); err != nil {
		return err
	}
	if err := conn.WriteJSON(voiceServerEvent{Type: "command_plan", Plan: planValue, Feedback: plan.Feedback}); err != nil {
		return err
	}

	tts, err := h.hub.TTS.Speak(ctx.Request.Context(), plan.Feedback)
	if err != nil {
		return err
	}
	return conn.WriteJSON(voiceServerEvent{Type: "feedback", Feedback: tts.Text})
}
