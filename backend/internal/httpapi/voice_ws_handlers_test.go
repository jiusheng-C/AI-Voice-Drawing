package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/aihub"
)

func TestVoiceWebSocketMockFlow(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	RegisterVoiceWSRoutes(router, aihub.NewMockHub())

	server := httptest.NewServer(router)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/projects/1/voice-stream"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}
	defer conn.Close()

	var ready voiceServerEvent
	if err := conn.ReadJSON(&ready); err != nil {
		t.Fatalf("read ready: %v", err)
	}
	if ready.Type != "ready" {
		t.Fatalf("expected ready, got %s", ready.Type)
	}

	if err := conn.WriteJSON(voiceClientEvent{Type: "text", Text: "画一个蓝色圆形"}); err != nil {
		t.Fatalf("write text event: %v", err)
	}

	var asr voiceServerEvent
	if err := conn.ReadJSON(&asr); err != nil {
		t.Fatalf("read asr event: %v", err)
	}
	if asr.Type != "asr_partial" || asr.Text != "画一个蓝色圆形" {
		t.Fatalf("unexpected asr event %#v", asr)
	}

	var plan voiceServerEvent
	if err := conn.ReadJSON(&plan); err != nil {
		t.Fatalf("read command plan event: %v", err)
	}
	if plan.Type != "command_plan" {
		t.Fatalf("expected command_plan, got %s", plan.Type)
	}
	encoded, _ := json.Marshal(plan.Plan)
	if !strings.Contains(string(encoded), "create_shape") {
		t.Fatalf("expected create_shape plan, got %s", encoded)
	}

	var feedback voiceServerEvent
	if err := conn.ReadJSON(&feedback); err != nil {
		t.Fatalf("read feedback event: %v", err)
	}
	if feedback.Type != "feedback" || feedback.Feedback == "" {
		t.Fatalf("unexpected feedback event %#v", feedback)
	}
}

func TestVoiceWebSocketEmptyVoiceDoesNotCreateDefaultCommand(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	RegisterVoiceWSRoutes(router, aihub.NewMockHub())

	server := httptest.NewServer(router)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/projects/1/voice-stream"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}
	defer conn.Close()

	var ready voiceServerEvent
	if err := conn.ReadJSON(&ready); err != nil {
		t.Fatalf("read ready: %v", err)
	}

	if err := conn.WriteJSON(voiceClientEvent{Type: "voice_end"}); err != nil {
		t.Fatalf("write empty voice_end event: %v", err)
	}

	var feedback voiceServerEvent
	if err := conn.ReadJSON(&feedback); err != nil {
		t.Fatalf("read feedback event: %v", err)
	}
	if feedback.Type != "feedback" {
		t.Fatalf("expected feedback for empty voice, got %s", feedback.Type)
	}
	if strings.Contains(feedback.Feedback, "画一个蓝色圆形") {
		t.Fatalf("empty voice should not use default drawing command: %#v", feedback)
	}
}
