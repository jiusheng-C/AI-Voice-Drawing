package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/models"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/projects"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListProviders(ctx context.Context) ([]models.AIProvider, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, provider_key, name, provider_type, COALESCE(base_url, ''), is_mock, is_enabled, created_at, updated_at
FROM ai_providers
ORDER BY id ASC
`)
	if err != nil {
		return nil, fmt.Errorf("list AI providers: %w", err)
	}
	defer rows.Close()

	var providers []models.AIProvider
	for rows.Next() {
		var provider models.AIProvider
		if err := rows.Scan(&provider.ID, &provider.ProviderKey, &provider.Name, &provider.ProviderType, &provider.BaseURL, &provider.IsMock, &provider.IsEnabled, &provider.CreatedAt, &provider.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan AI provider: %w", err)
		}
		providers = append(providers, provider)
	}
	return providers, rows.Err()
}

func (r *Repository) ListModels(ctx context.Context, capability string) ([]models.AIModel, error) {
	query := `
SELECT m.id, m.provider_id, p.provider_key, m.model_key, m.display_name, m.capability, m.mode, m.latency_tier, m.cost_tier, m.privacy_tier, m.supports_streaming, m.is_enabled, COALESCE(m.config_json, JSON_OBJECT()), m.created_at, m.updated_at
FROM ai_models m
JOIN ai_providers p ON p.id = m.provider_id
WHERE m.is_enabled = TRUE`
	args := []any{}
	if strings.TrimSpace(capability) != "" {
		query += " AND m.capability = ?"
		args = append(args, strings.TrimSpace(capability))
	}
	query += " ORDER BY m.capability ASC, m.id ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list AI models: %w", err)
	}
	defer rows.Close()

	var result []models.AIModel
	for rows.Next() {
		var model models.AIModel
		var config []byte
		if err := rows.Scan(&model.ID, &model.ProviderID, &model.ProviderKey, &model.ModelKey, &model.DisplayName, &model.Capability, &model.Mode, &model.LatencyTier, &model.CostTier, &model.PrivacyTier, &model.SupportsStreaming, &model.IsEnabled, &config, &model.CreatedAt, &model.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan AI model: %w", err)
		}
		if len(config) > 0 {
			if err := json.Unmarshal(config, &model.Config); err != nil {
				return nil, fmt.Errorf("decode AI model config: %w", err)
			}
		}
		result = append(result, model)
	}
	return result, rows.Err()
}

func (r *Repository) ListPreferences(ctx context.Context) ([]models.AIPreference, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, user_id, scenario, mode, primary_model_id, COALESCE(fallback_model_ids, JSON_ARRAY())
FROM user_ai_preferences
WHERE user_id = ?
ORDER BY scenario ASC
`, projects.DefaultUserID())
	if err != nil {
		return nil, fmt.Errorf("list AI preferences: %w", err)
	}
	defer rows.Close()

	var result []models.AIPreference
	for rows.Next() {
		var pref models.AIPreference
		var fallback []byte
		if err := rows.Scan(&pref.ID, &pref.UserID, &pref.Scenario, &pref.Mode, &pref.PrimaryModelID, &fallback); err != nil {
			return nil, fmt.Errorf("scan AI preference: %w", err)
		}
		if len(fallback) > 0 {
			if err := json.Unmarshal(fallback, &pref.FallbackModelIDs); err != nil {
				return nil, fmt.Errorf("decode AI preference fallback ids: %w", err)
			}
		}
		result = append(result, pref)
	}
	return result, rows.Err()
}

func (r *Repository) SavePreferences(ctx context.Context, preferences []models.AIPreference) ([]models.AIPreference, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin AI preferences transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
INSERT INTO users (id, display_name)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)
`, projects.DefaultUserID(), "Local Creator"); err != nil {
		return nil, fmt.Errorf("ensure default user: %w", err)
	}

	for _, pref := range preferences {
		fallback, err := json.Marshal(pref.FallbackModelIDs)
		if err != nil {
			return nil, fmt.Errorf("encode fallback model ids: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
INSERT INTO user_ai_preferences (user_id, scenario, mode, primary_model_id, fallback_model_ids)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE mode = VALUES(mode), primary_model_id = VALUES(primary_model_id), fallback_model_ids = VALUES(fallback_model_ids)
`, projects.DefaultUserID(), pref.Scenario, pref.Mode, pref.PrimaryModelID, fallback); err != nil {
			return nil, fmt.Errorf("save AI preference %q: %w", pref.Scenario, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit AI preferences transaction: %w", err)
	}
	return r.ListPreferences(ctx)
}

func (r *Repository) GetModel(ctx context.Context, id uint64) (models.AIModel, error) {
	allModels, err := r.ListModels(ctx, "")
	if err != nil {
		return models.AIModel{}, err
	}
	for _, model := range allModels {
		if model.ID == id {
			return model, nil
		}
	}
	return models.AIModel{}, sql.ErrNoRows
}
