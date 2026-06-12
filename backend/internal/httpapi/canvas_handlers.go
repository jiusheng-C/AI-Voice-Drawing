package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/canvas"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/models"
)

type canvasHandler struct {
	repo *canvas.Repository
}

type canvasStateRequest struct {
	Width   int                   `json:"width"`
	Height  int                   `json:"height"`
	Objects []canvasObjectRequest `json:"objects"`
}

type canvasObjectRequest struct {
	ObjectKey  string         `json:"object_key"`
	ObjectType string         `json:"object_type"`
	Name       string         `json:"name"`
	Properties map[string]any `json:"properties"`
}

func RegisterCanvasRoutes(router *gin.Engine, repo *canvas.Repository) {
	handler := canvasHandler{repo: repo}
	group := router.Group("/api/v1/projects/:id/canvas-state")
	group.GET("", handler.get)
	group.PUT("", handler.save)
}

func (h canvasHandler) get(ctx *gin.Context) {
	projectID, ok := parseProjectID(ctx)
	if !ok {
		return
	}

	state, err := h.repo.GetState(ctx.Request.Context(), projectID)
	if err != nil {
		respondCanvasError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"canvas_state": state})
}

func (h canvasHandler) save(ctx *gin.Context) {
	projectID, ok := parseProjectID(ctx)
	if !ok {
		return
	}

	var req canvasStateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	state := models.CanvasState{
		ProjectID: projectID,
		Width:     req.Width,
		Height:    req.Height,
		Objects:   make([]models.CanvasObject, 0, len(req.Objects)),
	}
	for _, input := range req.Objects {
		object := models.CanvasObject{
			ObjectKey:  strings.TrimSpace(input.ObjectKey),
			ObjectType: strings.TrimSpace(input.ObjectType),
			Name:       strings.TrimSpace(input.Name),
			Properties: input.Properties,
		}
		if object.ObjectKey == "" || object.ObjectType == "" {
			respondError(ctx, http.StatusBadRequest, "invalid_canvas_object", "object_key and object_type are required")
			return
		}
		if object.Properties == nil {
			object.Properties = map[string]any{}
		}
		state.Objects = append(state.Objects, object)
	}

	saved, err := h.repo.SaveState(ctx.Request.Context(), state)
	if err != nil {
		respondCanvasError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"canvas_state": saved})
}

func respondCanvasError(ctx *gin.Context, err error) {
	if errors.Is(err, canvas.ErrProjectNotFound) {
		respondError(ctx, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	respondError(ctx, http.StatusInternalServerError, "canvas_state_operation_failed", err.Error())
}
