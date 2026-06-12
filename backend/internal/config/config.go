package config

import "os"

type Config struct {
	AppEnv   string
	HTTPPort string
	MySQLDSN string
}

func Load() Config {
	return Config{
		AppEnv:   getEnv("APP_ENV", "local"),
		HTTPPort: getEnv("HTTP_PORT", "8080"),
		MySQLDSN: getEnv("MYSQL_DSN", "voice:voice@tcp(127.0.0.1:13306)/voice_drawing?parseTime=true&charset=utf8mb4&multiStatements=true"),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
