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

### Database Migrations

```bash
cd backend
go run ./cmd/migrate
```

Frontend commands will be enabled by later PRs.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## MVP Demo Flow

1. Start MySQL with `docker compose up -d mysql`.
2. Run migrations with `cd backend && go run ./cmd/migrate`.
3. Start the backend with `cd backend && go run ./cmd/server`.
4. Start the frontend with `cd frontend && npm run dev`.
5. Open `http://localhost:5173`.
6. Use the development text command box for deterministic checks:
   - `画一个蓝色圆形`
   - `画一个红色矩形`
   - `把它改成绿色`
   - `撤销`
7. Use Start voice and Stop voice to run the mock voice path.
8. Use PNG in the canvas toolbar to export the current canvas.

Run the local demo check:

```powershell
./scripts/demo-check.ps1
```

## Delivery Rules

All feature work must be delivered through small GitHub pull requests.
Each merged PR must keep the main branch runnable for the functionality available at that stage.
