package models

import "time"

type CanvasState struct {
	ProjectID uint64         `json:"project_id"`
	Width     int            `json:"width"`
	Height    int            `json:"height"`
	Objects   []CanvasObject `json:"objects"`
	UpdatedAt *time.Time     `json:"updated_at,omitempty"`
}

type CanvasObject struct {
	ObjectKey  string         `json:"object_key"`
	ObjectType string         `json:"object_type"`
	Name       string         `json:"name,omitempty"`
	Properties map[string]any `json:"properties"`
}
