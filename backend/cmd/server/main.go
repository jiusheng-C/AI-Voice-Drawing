package main

import (
	"log"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/config"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/httpapi"
)

func main() {
	cfg := config.Load()
	router := httpapi.NewRouter()

	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
