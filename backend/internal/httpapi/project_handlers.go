package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/projects"
)

type projectHandler struct {
	repo *projects.Repository
}

type projectRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	CanvasWidth  int    `json:"canvas_width"`
	CanvasHeight int    `json:"canvas_height"`
}

func RegisterProjectRoutes(router *gin.Engine, repo *projects.Repository) {
	handler := projectHandler{repo: repo}
	group := router.Group("/api/v1/projects")
	group.POST("", handler.create)
	group.GET("", handler.list)
	group.GET("/:id", handler.get)
	group.PUT("/:id", handler.update)
}

func (h projectHandler) create(ctx *gin.Context) {
	var req projectRequest
	if !bindProjectRequest(ctx, &req) {
		return
	}

	project, err := h.repo.Create(ctx.Request.Context(), projects.CreateProjectInput{
		Name:         req.Name,
		Description:  req.Description,
		CanvasWidth:  req.CanvasWidth,
		CanvasHeight: req.CanvasHeight,
	})
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "create_project_failed", err.Error())
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"project": project})
}

func (h projectHandler) list(ctx *gin.Context) {
	results, err := h.repo.List(ctx.Request.Context())
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "list_projects_failed", err.Error())
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"projects": results})
}

func (h projectHandler) get(ctx *gin.Context) {
	id, ok := parseProjectID(ctx)
	if !ok {
		return
	}

	project, err := h.repo.Get(ctx.Request.Context(), id)
	if err != nil {
		respondProjectError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"project": project})
}

func (h projectHandler) update(ctx *gin.Context) {
	id, ok := parseProjectID(ctx)
	if !ok {
		return
	}

	var req projectRequest
	if !bindProjectRequest(ctx, &req) {
		return
	}

	project, err := h.repo.Update(ctx.Request.Context(), id, projects.UpdateProjectInput{
		Name:         req.Name,
		Description:  req.Description,
		CanvasWidth:  req.CanvasWidth,
		CanvasHeight: req.CanvasHeight,
	})
	if err != nil {
		respondProjectError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"project": project})
}

func bindProjectRequest(ctx *gin.Context, req *projectRequest) bool {
	if err := ctx.ShouldBindJSON(req); err != nil {
		respondError(ctx, http.StatusBadRequest, "invalid_json", err.Error())
		return false
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		respondError(ctx, http.StatusBadRequest, "project_name_required", "project name is required")
		return false
	}
	return true
}

func parseProjectID(ctx *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil || id == 0 {
		respondError(ctx, http.StatusBadRequest, "invalid_project_id", "project id must be a positive integer")
		return 0, false
	}
	return id, true
}

func respondProjectError(ctx *gin.Context, err error) {
	if errors.Is(err, projects.ErrNotFound) {
		respondError(ctx, http.StatusNotFound, "project_not_found", "project not found")
		return
	}
	respondError(ctx, http.StatusInternalServerError, "project_operation_failed", err.Error())
}

func respondError(ctx *gin.Context, status int, code string, message string) {
	ctx.JSON(status, gin.H{
		"error": gin.H{
			"code":    code,
			"message": message,
		},
	})
}
