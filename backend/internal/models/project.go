package models

import "time"

type Project struct {
	ID           uint64    `json:"id"`
	OwnerUserID  uint64    `json:"owner_user_id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	CanvasWidth  int       `json:"canvas_width"`
	CanvasHeight int       `json:"canvas_height"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
