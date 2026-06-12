# AI Voice Drawing

AI Voice Drawing is a browser-based drawing workspace controlled by voice.
The MVP uses a Go + Gin backend, MySQL persistence, a React + TypeScript + Vite frontend, and Fabric.js for canvas rendering.

The first screen is the drawing workspace. Marketing or landing pages are intentionally out of scope.

## Current Stage

This repository currently contains the project development plan and the base directory structure for incremental PR delivery.

## Repository Layout

```text
backend/   Go backend service, API, database access, migrations, and AIHub providers
frontend/  React + TypeScript + Vite workspace UI and Fabric.js canvas client
docs/      Implementation notes, API contracts, and demo scripts
```

## Local Development

### MySQL

```bash
docker compose up -d mysql
```

The local database listens on `127.0.0.1:13306` by default and creates the `voice_drawing` database.
Set `MYSQL_PORT` to override the host port. The default application DSN is defined in `.env.example`.

### Backend

```bash
cd backend
go mod tidy
go run ./cmd/server
```

Set `HTTP_PORT` if port `8080` is already in use.

Health check:

```bash
curl http://localhost:8080/healthz
```

Project API:

```bash
curl -X POST http://localhost:8080/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Voice demo","description":"MVP drawing project"}'

curl http://localhost:8080/api/v1/projects
```

Canvas state API:

```bash
curl -X PUT http://localhost:8080/api/v1/projects/1/canvas-state \
  -H "Content-Type: application/json" \
  -d '{"width":1280,"height":720,"objects":[{"object_key":"obj_1","object_type":"circle","name":"Blue circle","properties":{"fill":"#2563eb","left":540,"top":260,"radius":80}}]}'

curl http://localhost:8080/api/v1/projects/1/canvas-state
```

### Database Migrations

```bash
cd backend
go run ./cmd/migrate
```

Frontend commands will be enabled by later PRs.

## Delivery Rules

All feature work must be delivered through small GitHub pull requests.
Each merged PR must keep the main branch runnable for the functionality available at that stage.
