package models

import "time"

type AIProvider struct {
	ID           uint64    `json:"id"`
	ProviderKey  string    `json:"provider_key"`
	Name         string    `json:"name"`
	ProviderType string    `json:"provider_type"`
	BaseURL      string    `json:"base_url,omitempty"`
	IsMock       bool      `json:"is_mock"`
	IsEnabled    bool      `json:"is_enabled"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AIModel struct {
	ID                uint64         `json:"id"`
	ProviderID        uint64         `json:"provider_id"`
	ProviderKey       string         `json:"provider_key"`
	ModelKey          string         `json:"model_key"`
	DisplayName       string         `json:"display_name"`
	Capability        string         `json:"capability"`
	Mode              string         `json:"mode"`
	LatencyTier       string         `json:"latency_tier"`
	CostTier          string         `json:"cost_tier"`
	PrivacyTier       string         `json:"privacy_tier"`
	SupportsStreaming bool           `json:"supports_streaming"`
	IsEnabled         bool           `json:"is_enabled"`
	Config            map[string]any `json:"config,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type AIPreference struct {
	ID               uint64   `json:"id"`
	UserID           uint64   `json:"user_id"`
	Scenario         string   `json:"scenario"`
	Mode             string   `json:"mode"`
	PrimaryModelID   uint64   `json:"primary_model_id"`
	FallbackModelIDs []uint64 `json:"fallback_model_ids"`
}
