package main

import (
	"log"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/config"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/db"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/httpapi"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/projects"
)

func main() {
	cfg := config.Load()
	router := httpapi.NewRouter()

	conn, err := db.Open(cfg)
	if err != nil {
		log.Printf("database unavailable: %v", err)
	} else {
		defer conn.Close()
		httpapi.RegisterProjectRoutes(router, projects.NewRepository(conn))
	}

	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
