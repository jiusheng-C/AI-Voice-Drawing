package main

import (
	"database/sql"
	"flag"
	"log"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/config"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/db/migrations"
)

func main() {
	direction := flag.String("direction", "up", "migration direction: up")
	flag.Parse()

	if *direction != "up" {
		log.Fatalf("unsupported migration direction %q", *direction)
	}

	cfg := config.Load()
	conn, err := sql.Open("mysql", cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer conn.Close()

	if err := conn.Ping(); err != nil {
		log.Fatalf("ping database: %v", err)
	}

	if err := migrations.Up(conn); err != nil {
		log.Fatalf("apply migrations: %v", err)
	}

	log.Println("migrations applied")
}
