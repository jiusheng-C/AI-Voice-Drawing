package migrations

import (
	"database/sql"
	"fmt"
)

type Migration struct {
	Version int
	Name    string
	SQL     string
}

var all = []Migration{
	{
		Version: 1,
		Name:    "create_core_tables",
		SQL: `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  canvas_width INT NOT NULL DEFAULT 1280,
  canvas_height INT NOT NULL DEFAULT 720,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvas_objects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  object_key VARCHAR(80) NOT NULL,
  object_type VARCHAR(40) NOT NULL,
  name VARCHAR(160) NULL,
  properties JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_canvas_objects_project_key (project_id, object_key),
  CONSTRAINT fk_canvas_objects_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvas_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  snapshot_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_canvas_snapshots_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS command_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NULL,
  source VARCHAR(30) NOT NULL,
  asr_text TEXT NULL,
  command_plan JSON NOT NULL,
  status VARCHAR(30) NOT NULL,
  feedback TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_command_logs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`,
	},
	{
		Version: 2,
		Name:    "create_ai_model_center_tables",
		SQL: `
CREATE TABLE IF NOT EXISTS ai_providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider_key VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  provider_type VARCHAR(40) NOT NULL,
  base_url VARCHAR(500) NULL,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ai_providers_key (provider_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider_id BIGINT UNSIGNED NOT NULL,
  model_key VARCHAR(120) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  capability VARCHAR(40) NOT NULL,
  mode VARCHAR(40) NOT NULL,
  latency_tier VARCHAR(40) NOT NULL,
  cost_tier VARCHAR(40) NOT NULL,
  privacy_tier VARCHAR(40) NOT NULL,
  supports_streaming BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ai_models_key (model_key),
  KEY idx_ai_models_capability (capability),
  CONSTRAINT fk_ai_models_provider FOREIGN KEY (provider_id) REFERENCES ai_providers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_ai_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  scenario VARCHAR(80) NOT NULL,
  mode VARCHAR(40) NOT NULL,
  primary_model_id BIGINT UNSIGNED NOT NULL,
  fallback_model_ids JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_ai_preferences_scenario (user_id, scenario),
  CONSTRAINT fk_user_ai_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_ai_preferences_model FOREIGN KEY (primary_model_id) REFERENCES ai_models(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS model_invocation_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  model_id BIGINT UNSIGNED NULL,
  provider_key VARCHAR(80) NOT NULL,
  model_key VARCHAR(120) NOT NULL,
  capability VARCHAR(40) NOT NULL,
  latency_ms INT NULL,
  input_tokens INT NULL,
  output_tokens INT NULL,
  audio_duration_ms INT NULL,
  confidence DECIMAL(5,4) NULL,
  success BOOLEAN NOT NULL,
  error_code VARCHAR(120) NULL,
  cost_estimate DECIMAL(12,6) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_model_invocation_logs_created_at (created_at),
  CONSTRAINT fk_model_invocation_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_model_invocation_logs_model FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ai_providers (provider_key, name, provider_type, base_url, is_mock, is_enabled)
VALUES ('mock-aihub', 'Mock AIHub Provider', 'mock', NULL, TRUE, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), provider_type = VALUES(provider_type), is_mock = VALUES(is_mock), is_enabled = VALUES(is_enabled);

INSERT INTO ai_models (provider_id, model_key, display_name, capability, mode, latency_tier, cost_tier, privacy_tier, supports_streaming, is_enabled, config_json)
SELECT id, 'mock-asr-fast', 'Mock ASR Fast', 'asr', 'fast', 'low', 'free', 'local_mock', TRUE, TRUE, JSON_OBJECT('language', 'zh-CN')
FROM ai_providers WHERE provider_key = 'mock-aihub'
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), capability = VALUES(capability), mode = VALUES(mode), is_enabled = VALUES(is_enabled);

INSERT INTO ai_models (provider_id, model_key, display_name, capability, mode, latency_tier, cost_tier, privacy_tier, supports_streaming, is_enabled, config_json)
SELECT id, 'mock-nlu-rule', 'Mock NLU Rule Parser', 'nlu', 'fast', 'low', 'free', 'local_mock', FALSE, TRUE, JSON_OBJECT('parser', 'rules')
FROM ai_providers WHERE provider_key = 'mock-aihub'
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), capability = VALUES(capability), mode = VALUES(mode), is_enabled = VALUES(is_enabled);

INSERT INTO ai_models (provider_id, model_key, display_name, capability, mode, latency_tier, cost_tier, privacy_tier, supports_streaming, is_enabled, config_json)
SELECT id, 'mock-tts-browser', 'Mock Browser TTS', 'tts', 'fast', 'low', 'free', 'browser', FALSE, TRUE, JSON_OBJECT('voice', 'browser-default')
FROM ai_providers WHERE provider_key = 'mock-aihub'
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), capability = VALUES(capability), mode = VALUES(mode), is_enabled = VALUES(is_enabled);
`,
	},
}

func Up(db *sql.DB) error {
	if _, err := db.Exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	for _, migration := range all {
		applied, err := isApplied(db, migration.Version)
		if err != nil {
			return err
		}
		if applied {
			continue
		}

		if _, err := db.Exec(migration.SQL); err != nil {
			return fmt.Errorf("migration %d %s: %w", migration.Version, migration.Name, err)
		}
		if _, err := db.Exec("INSERT INTO schema_migrations (version, name) VALUES (?, ?)", migration.Version, migration.Name); err != nil {
			return fmt.Errorf("record migration %d: %w", migration.Version, err)
		}
	}

	return nil
}

func isApplied(db *sql.DB, version int) (bool, error) {
	var exists int
	if err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = ?", version).Scan(&exists); err != nil {
		return false, fmt.Errorf("check migration %d: %w", version, err)
	}
	return exists > 0, nil
}
