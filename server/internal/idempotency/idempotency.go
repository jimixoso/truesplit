// Package idempotency enforces the PRD §5 idempotency contract:
//
//   - Same (scope, key, hash) → return the cached response, never re-run.
//   - Same (scope, key) + different hash → 409 Conflict.
//   - Redis is a fast-path optimisation; Postgres UNIQUE(scope, idempotency_key)
//     is the real source of truth and the tiebreaker under concurrent races.
package idempotency

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

var (
	ErrInFlight    = errors.New("idempotency: request in flight, retry shortly")
	ErrHashMismatch = errors.New("idempotency: key reused with different request payload")
)

// WorkFn is the actual transaction logic. It receives an open Postgres TX and
// must return the HTTP response body + status code. The TX is committed by
// Resolve on success; the caller must NOT commit or rollback it.
type WorkFn func(ctx context.Context, tx pgx.Tx) (body []byte, statusCode int, err error)

type cached struct {
	StatusCode int    `json:"status_code"`
	Body       []byte `json:"body"` // base64 in JSON
}

// HashBody returns the hex-encoded SHA-256 of b.
func HashBody(b []byte) string {
	h := sha256.Sum256(b)
	return fmt.Sprintf("%x", h)
}

// Resolve executes fn exactly once for a given (scope, key, hash) triple.
//
// Flow (mirrors PRD §5):
//  1. Check Redis for a cached response or IN_FLIGHT sentinel.
//  2. Set IN_FLIGHT, open a Postgres TX, and try to INSERT the idempotency record.
//  3. On a UNIQUE conflict (concurrent race past Redis), read the committed record.
//  4. On win: run fn, update the record with the real response, commit, cache in Redis.
func Resolve(
	ctx context.Context,
	pool *pgxpool.Pool,
	rdb *redis.Client,
	scope, key, hash string,
	fn WorkFn,
) ([]byte, int, error) {
	redisKey := fmt.Sprintf("idemp:%s:%s", scope, key)

	// ── 1. Fast-path: check Redis ──────────────────────────────────────────
	if val, err := rdb.Get(ctx, redisKey).Result(); err == nil {
		if val == "IN_FLIGHT" {
			return nil, 409, ErrInFlight
		}
		var c cached
		if err := json.Unmarshal([]byte(val), &c); err == nil {
			return c.Body, c.StatusCode, nil
		}
	}

	// ── 2. Mark IN_FLIGHT in Redis ─────────────────────────────────────────
	rdb.Set(ctx, redisKey, "IN_FLIGHT", 30*time.Second)

	// ── 3. Open Postgres TX and race for the idempotency record ───────────
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, 500, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var recordID string
	insertErr := tx.QueryRow(ctx, `
		INSERT INTO idempotency_records
			(scope, idempotency_key, request_hash, response_body, status_code, expires_at)
		VALUES ($1, $2, $3, '{}', 0, now() + interval '24 hours')
		ON CONFLICT (scope, idempotency_key) DO NOTHING
		RETURNING id
	`, scope, key, hash).Scan(&recordID)

	if insertErr != nil {
		// ON CONFLICT DO NOTHING returned no rows — we lost the race.
		return resolveConflict(ctx, tx, rdb, redisKey, scope, key, hash)
	}

	// ── 4. We won — run the actual work ────────────────────────────────────
	body, status, err := fn(ctx, tx)
	if err != nil {
		return nil, 500, fmt.Errorf("work fn: %w", err)
	}

	// Update the placeholder with the real response.
	if _, err := tx.Exec(ctx, `
		UPDATE idempotency_records
		SET response_body = $1, status_code = $2
		WHERE scope = $3 AND idempotency_key = $4
	`, json.RawMessage(body), status, scope, key); err != nil {
		return nil, 500, fmt.Errorf("update idempotency record: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, 500, fmt.Errorf("commit: %w", err)
	}

	cacheInRedis(ctx, rdb, redisKey, body, status)
	return body, status, nil
}

// resolveConflict is called when we lost the UNIQUE-constraint race.
// It reads the committed winner's record and returns the cached response.
func resolveConflict(
	ctx context.Context,
	tx pgx.Tx,
	rdb *redis.Client,
	redisKey, scope, key, ourHash string,
) ([]byte, int, error) {
	var existingHash string
	var existingBody json.RawMessage
	var existingStatus int

	err := tx.QueryRow(ctx, `
		SELECT request_hash, response_body, status_code
		FROM idempotency_records
		WHERE scope = $1 AND idempotency_key = $2
	`, scope, key).Scan(&existingHash, &existingBody, &existingStatus)
	if err != nil {
		// Winner hasn't committed yet — tell client to retry.
		return nil, 409, ErrInFlight
	}

	if existingHash != ourHash {
		return nil, 409, ErrHashMismatch
	}
	if existingStatus == 0 {
		// Winner is still processing.
		return nil, 409, ErrInFlight
	}

	body := []byte(existingBody)
	cacheInRedis(ctx, rdb, redisKey, body, existingStatus)
	return body, existingStatus, nil
}

func cacheInRedis(ctx context.Context, rdb *redis.Client, key string, body []byte, status int) {
	b, _ := json.Marshal(cached{StatusCode: status, Body: body})
	rdb.Set(ctx, key, string(b), 24*time.Hour)
}
