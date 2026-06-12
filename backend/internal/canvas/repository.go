package canvas

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/models"
	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/projects"
)

var ErrProjectNotFound = errors.New("project not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetState(ctx context.Context, projectID uint64) (models.CanvasState, error) {
	var state models.CanvasState
	err := r.db.QueryRowContext(ctx, `
SELECT id, canvas_width, canvas_height
FROM projects
WHERE id = ? AND owner_user_id = ?
`, projectID, projects.DefaultUserID()).Scan(&state.ProjectID, &state.Width, &state.Height)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.CanvasState{}, ErrProjectNotFound
		}
		return models.CanvasState{}, fmt.Errorf("read project canvas size: %w", err)
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT object_key, object_type, COALESCE(name, ''), properties
FROM canvas_objects
WHERE project_id = ?
ORDER BY id ASC
`, projectID)
	if err != nil {
		return models.CanvasState{}, fmt.Errorf("list canvas objects: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var object models.CanvasObject
		var properties []byte
		if err := rows.Scan(&object.ObjectKey, &object.ObjectType, &object.Name, &properties); err != nil {
			return models.CanvasState{}, fmt.Errorf("scan canvas object: %w", err)
		}
		if len(properties) > 0 {
			if err := json.Unmarshal(properties, &object.Properties); err != nil {
				return models.CanvasState{}, fmt.Errorf("decode canvas object properties: %w", err)
			}
		}
		state.Objects = append(state.Objects, object)
	}
	if err := rows.Err(); err != nil {
		return models.CanvasState{}, fmt.Errorf("iterate canvas objects: %w", err)
	}
	return state, nil
}

func (r *Repository) SaveState(ctx context.Context, state models.CanvasState) (models.CanvasState, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return models.CanvasState{}, fmt.Errorf("begin canvas transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
UPDATE projects
SET canvas_width = ?, canvas_height = ?
WHERE id = ? AND owner_user_id = ?
`, normalizeSize(state.Width, 1280), normalizeSize(state.Height, 720), state.ProjectID, projects.DefaultUserID())
	if err != nil {
		return models.CanvasState{}, fmt.Errorf("update project canvas size: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return models.CanvasState{}, fmt.Errorf("read project canvas update rows: %w", err)
	}
	if affected == 0 {
		exists, err := r.projectExists(ctx, state.ProjectID)
		if err != nil {
			return models.CanvasState{}, err
		}
		if !exists {
			return models.CanvasState{}, ErrProjectNotFound
		}
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM canvas_objects WHERE project_id = ?", state.ProjectID); err != nil {
		return models.CanvasState{}, fmt.Errorf("replace canvas objects: %w", err)
	}

	for _, object := range state.Objects {
		properties, err := json.Marshal(object.Properties)
		if err != nil {
			return models.CanvasState{}, fmt.Errorf("encode canvas object %q properties: %w", object.ObjectKey, err)
		}
		if _, err := tx.ExecContext(ctx, `
INSERT INTO canvas_objects (project_id, object_key, object_type, name, properties)
VALUES (?, ?, ?, ?, ?)
`, state.ProjectID, object.ObjectKey, object.ObjectType, nullIfEmpty(object.Name), properties); err != nil {
			return models.CanvasState{}, fmt.Errorf("insert canvas object %q: %w", object.ObjectKey, err)
		}
	}

	snapshot, err := json.Marshal(state)
	if err != nil {
		return models.CanvasState{}, fmt.Errorf("encode canvas snapshot: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
INSERT INTO canvas_snapshots (project_id, snapshot_json)
VALUES (?, ?)
`, state.ProjectID, snapshot); err != nil {
		return models.CanvasState{}, fmt.Errorf("insert canvas snapshot: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return models.CanvasState{}, fmt.Errorf("commit canvas transaction: %w", err)
	}
	return r.GetState(ctx, state.ProjectID)
}

func normalizeSize(value int, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func nullIfEmpty(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}

func (r *Repository) projectExists(ctx context.Context, projectID uint64) (bool, error) {
	var count int
	if err := r.db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM projects
WHERE id = ? AND owner_user_id = ?
`, projectID, projects.DefaultUserID()).Scan(&count); err != nil {
		return false, fmt.Errorf("check project exists: %w", err)
	}
	return count > 0, nil
}
