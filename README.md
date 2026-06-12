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

The full local commands will be enabled by later PRs:

```bash
docker compose up -d mysql
go run ./backend/cmd/server
cd frontend && npm run dev
```

## Delivery Rules

All feature work must be delivered through small GitHub pull requests.
Each merged PR must keep the main branch runnable for the functionality available at that stage.
