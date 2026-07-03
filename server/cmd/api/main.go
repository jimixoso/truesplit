package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"

	"github.com/jimixoso/truesplit/internal/db"
	"github.com/jimixoso/truesplit/internal/handler"
	"github.com/jimixoso/truesplit/internal/sse"
	"github.com/redis/go-redis/v9"
)

func main() {
	ctx := context.Background()

	// ── Postgres ────────────────────────────────────────────────────────────
	pool, err := db.NewPool(ctx)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()

	// Run migrations from /migrations relative to the repo root.
	migrationsDir := migrationsPath()
	if err := db.Migrate(ctx, pool, migrationsDir); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// ── Redis ────────────────────────────────────────────────────────────────
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("parse REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	// ── HTTP server ──────────────────────────────────────────────────────────
	hub := sse.NewHub()
	srv := handler.NewServer(pool, rdb, hub)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok")) //nolint:errcheck
	})
	srv.Routes(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("TrueSplit listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

// migrationsPath resolves /migrations relative to this source file's location,
// so it works regardless of the working directory the binary is run from.
func migrationsPath() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("cannot determine source file path")
	}
	// file = .../server/cmd/api/main.go → go up 3 dirs to repo root
	root := filepath.Join(filepath.Dir(file), "..", "..", "..")
	p := filepath.Join(root, "migrations")
	if _, err := os.Stat(p); err != nil {
		log.Fatalf("migrations dir not found at %s: %v", p, err)
	}
	return p
}
