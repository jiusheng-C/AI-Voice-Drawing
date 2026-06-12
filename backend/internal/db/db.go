package db

import (
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/config"
)

func Open(cfg config.Config) (*sql.DB, error) {
	conn, err := sql.Open("mysql", cfg.MySQLDSN)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("ping mysql: %w", err)
	}
	return conn, nil
}
