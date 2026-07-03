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
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// migrationsPath returns the migrations directory. In production (Docker) it
// reads MIGRATIONS_DIR. In local dev it falls back to the source-relative path.
func migrationsPath() string {
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("cannot locate migrations: set MIGRATIONS_DIR env var")
	}
	// file = .../server/cmd/api/main.go → go up 3 dirs to repo root
	p := filepath.Join(filepath.Dir(file), "..", "..", "..", "migrations")
	if _, err := os.Stat(p); err != nil {
		log.Fatalf("migrations dir not found at %s: %v", p, err)
	}
	return p
}
