package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/commands"
)

type textCommandRequest struct {
	Text string `json:"text"`
}

func RegisterTextCommandRoutes(router *gin.Engine, parser commands.RuleParser) {
	handler := textCommandHandler{parser: parser}
	router.POST("/api/v1/projects/:id/text-commands", handler.parse)
}

type textCommandHandler struct {
	parser commands.RuleParser
}

func (h textCommandHandler) parse(ctx *gin.Context) {
	if _, ok := parseProjectID(ctx); !ok {
		return
	}

	var req textCommandRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	plan := h.parser.ParseText(req.Text)
	ctx.JSON(http.StatusOK, gin.H{"command_plan": plan})
}
