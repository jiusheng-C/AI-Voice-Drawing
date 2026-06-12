package projects

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/jiusheng-C/AI-Voice-Drawing/backend/internal/models"
)

const defaultUserID uint64 = 1

var ErrNotFound = errors.New("project not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type CreateProjectInput struct {
	Name         string
	Description  string
	CanvasWidth  int
	CanvasHeight int
}

type UpdateProjectInput struct {
	Name         string
	Description  string
	CanvasWidth  int
	CanvasHeight int
}

func (r *Repository) EnsureDefaultUser(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
INSERT INTO users (id, display_name)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)
`, defaultUserID, "Local Creator")
	if err != nil {
		return fmt.Errorf("ensure default user: %w", err)
	}
	return nil
}

func (r *Repository) Create(ctx context.Context, input CreateProjectInput) (models.Project, error) {
	if err := r.EnsureDefaultUser(ctx); err != nil {
		return models.Project{}, err
	}

	width, height := normalizeCanvasSize(input.CanvasWidth, input.CanvasHeight)
	result, err := r.db.ExecContext(ctx, `
INSERT INTO projects (owner_user_id, name, description, canvas_width, canvas_height)
VALUES (?, ?, ?, ?, ?)
`, defaultUserID, input.Name, input.Description, width, height)
	if err != nil {
		return models.Project{}, fmt.Errorf("create project: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return models.Project{}, fmt.Errorf("read created project id: %w", err)
	}
	return r.Get(ctx, uint64(id))
}

func (r *Repository) List(ctx context.Context) ([]models.Project, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, owner_user_id, name, COALESCE(description, ''), canvas_width, canvas_height, created_at, updated_at
FROM projects
WHERE owner_user_id = ?
ORDER BY updated_at DESC, id DESC
`, defaultUserID)
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	defer rows.Close()

	var results []models.Project
	for rows.Next() {
		var project models.Project
		if err := scanProject(rows, &project); err != nil {
			return nil, err
		}
		results = append(results, project)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate projects: %w", err)
	}
	return results, nil
}

func (r *Repository) Get(ctx context.Context, id uint64) (models.Project, error) {
	row := r.db.QueryRowContext(ctx, `
SELECT id, owner_user_id, name, COALESCE(description, ''), canvas_width, canvas_height, created_at, updated_at
FROM projects
WHERE id = ? AND owner_user_id = ?
`, id, defaultUserID)

	var project models.Project
	if err := scanProject(row, &project); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Project{}, ErrNotFound
		}
		return models.Project{}, err
	}
	return project, nil
}

func (r *Repository) Update(ctx context.Context, id uint64, input UpdateProjectInput) (models.Project, error) {
	width, height := normalizeCanvasSize(input.CanvasWidth, input.CanvasHeight)
	result, err := r.db.ExecContext(ctx, `
UPDATE projects
SET name = ?, description = ?, canvas_width = ?, canvas_height = ?
WHERE id = ? AND owner_user_id = ?
`, input.Name, input.Description, width, height, id, defaultUserID)
	if err != nil {
		return models.Project{}, fmt.Errorf("update project: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return models.Project{}, fmt.Errorf("read updated rows: %w", err)
	}
	if affected == 0 {
		return models.Project{}, ErrNotFound
	}
	return r.Get(ctx, id)
}

type projectScanner interface {
	Scan(dest ...any) error
}

func scanProject(scanner projectScanner, project *models.Project) error {
	if err := scanner.Scan(
		&project.ID,
		&project.OwnerUserID,
		&project.Name,
		&project.Description,
		&project.CanvasWidth,
		&project.CanvasHeight,
		&project.CreatedAt,
		&project.UpdatedAt,
	); err != nil {
		return fmt.Errorf("scan project: %w", err)
	}
	return nil
}

func normalizeCanvasSize(width, height int) (int, int) {
	if width <= 0 {
		width = 1280
	}
	if height <= 0 {
		height = 720
	}
	return width, height
}
