package config

import "os"

type Config struct {
	AppEnv   string
	HTTPPort string
}

func Load() Config {
	return Config{
		AppEnv:   getEnv("APP_ENV", "local"),
		HTTPPort: getEnv("HTTP_PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
