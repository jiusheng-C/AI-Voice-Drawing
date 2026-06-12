package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/ai"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/models"
)

type aiHandler struct {
	repo *ai.Repository
}

type preferencesRequest struct {
	Preferences []preferenceRequest `json:"preferences"`
}

type preferenceRequest struct {
	Scenario         string   `json:"scenario"`
	Mode             string   `json:"mode"`
	PrimaryModelID   uint64   `json:"primary_model_id"`
	FallbackModelIDs []uint64 `json:"fallback_model_ids"`
}

func RegisterAIRoutes(router *gin.Engine, repo *ai.Repository) {
	handler := aiHandler{repo: repo}
	group := router.Group("/api/v1/ai")
	group.GET("/providers", handler.providers)
	group.GET("/models", handler.models)
	group.POST("/models/:id/test", handler.testModel)
	router.GET("/api/v1/users/me/ai-preferences", handler.getPreferences)
	router.PUT("/api/v1/users/me/ai-preferences", handler.savePreferences)
}

func (h aiHandler) providers(ctx *gin.Context) {
	providers, err := h.repo.ListProviders(ctx.Request.Context())
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "list_ai_providers_failed", err.Error())
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"providers": providers})
}

func (h aiHandler) models(ctx *gin.Context) {
	models, err := h.repo.ListModels(ctx.Request.Context(), ctx.Query("capability"))
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "list_ai_models_failed", err.Error())
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"models": models})
}

func (h aiHandler) getPreferences(ctx *gin.Context) {
	preferences, err := h.repo.ListPreferences(ctx.Request.Context())
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "list_ai_preferences_failed", err.Error())
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"preferences": preferences})
}

func (h aiHandler) savePreferences(ctx *gin.Context) {
	var req preferencesRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	preferences := make([]models.AIPreference, 0, len(req.Preferences))
	for _, input := range req.Preferences {
		if strings.TrimSpace(input.Scenario) == "" || strings.TrimSpace(input.Mode) == "" || input.PrimaryModelID == 0 {
			respondError(ctx, http.StatusBadRequest, "invalid_ai_preference", "scenario, mode, and primary_model_id are required")
			return
		}
		preferences = append(preferences, models.AIPreference{
			Scenario:         strings.TrimSpace(input.Scenario),
			Mode:             strings.TrimSpace(input.Mode),
			PrimaryModelID:   input.PrimaryModelID,
			FallbackModelIDs: input.FallbackModelIDs,
		})
	}

	saved, err := h.repo.SavePreferences(ctx.Request.Context(), preferences)
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "save_ai_preferences_failed", err.Error())
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"preferences": saved})
}

func (h aiHandler) testModel(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil || id == 0 {
		respondError(ctx, http.StatusBadRequest, "invalid_model_id", "model id must be a positive integer")
		return
	}

	model, err := h.repo.GetModel(ctx.Request.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(ctx, http.StatusNotFound, "model_not_found", "model not found")
			return
		}
		respondError(ctx, http.StatusInternalServerError, "test_ai_model_failed", err.Error())
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"result": gin.H{
			"model_id":     model.ID,
			"model_key":    model.ModelKey,
			"capability":   model.Capability,
			"success":      true,
			"latency_ms":   12,
			"message":      "mock model test passed",
			"provider":     model.ProviderKey,
			"streaming":    model.SupportsStreaming,
			"privacy_tier": model.PrivacyTier,
		},
	})
}
