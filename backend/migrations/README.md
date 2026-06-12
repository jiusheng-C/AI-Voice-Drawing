# Database Migrations

Migrations are defined in `backend/internal/db/migrations`.

Run all pending migrations:

```bash
cd backend
go run ./cmd/migrate
```

The command uses `MYSQL_DSN` or the local default from `.env.example`.
