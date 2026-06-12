package httpapi

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func NewRouter() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Recovery())

	router.GET("/healthz", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"service":   "ai-voice-drawing-api",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	return router
}
