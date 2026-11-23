// Package syncstore stores opaque, client-encrypted blobs for the OPTIONAL
// multi-device sync feature. The server never sees keys or plaintext.
package syncstore

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"time"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("version conflict")
)

type Blob struct {
	Data      string    `json:"data"`
	Version   int64     `json:"version"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Store interface {
	Get(ctx context.Context, id string) (Blob, error)
	// Put stores data if expectedVersion matches the current version (0 = create).
	Put(ctx context.Context, id, data string, expectedVersion int64) (Blob, error)
	Delete(ctx context.Context, id string) error
}

// ---- Postgres ----

type Postgres struct{ DB *sql.DB }

func (p Postgres) Get(ctx context.Context, id string) (Blob, error) {
	var b Blob
	err := p.DB.QueryRowContext(ctx,
		`SELECT data, version, updated_at FROM sync_blobs WHERE id = $1`, id).
		Scan(&b.Data, &b.Version, &b.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return b, ErrNotFound
	}
	return b, err
}

func (p Postgres) Put(ctx context.Context, id, data string, expected int64) (Blob, error) {
	var b Blob
	var err error
	if expected == 0 {
		err = p.DB.QueryRowContext(ctx,
			`INSERT INTO sync_blobs (id, data, version) VALUES ($1, $2, 1)
			 ON CONFLICT (id) DO NOTHING
			 RETURNING data, version, updated_at`, id, data).Scan(&b.Data, &b.Version, &b.UpdatedAt)
	} else {
		err = p.DB.QueryRowContext(ctx,
			`UPDATE sync_blobs SET data = $2, version = version + 1, updated_at = now()
			 WHERE id = $1 AND version = $3
			 RETURNING data, version, updated_at`, id, data, expected).Scan(&b.Data, &b.Version, &b.UpdatedAt)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return b, ErrConflict
	}
	return b, err
}

func (p Postgres) Delete(ctx context.Context, id string) error {
	_, err := p.DB.ExecContext(ctx, `DELETE FROM sync_blobs WHERE id = $1`, id)
	return err
}

// ---- Memory (dev and tests) ----

type Memory struct {
	mu sync.Mutex
	m  map[string]Blob
}

func NewMemory() *Memory { return &Memory{m: map[string]Blob{}} }

func (s *Memory) Get(_ context.Context, id string) (Blob, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, ok := s.m[id]
	if !ok {
		return b, ErrNotFound
	}
	return b, nil
}

func (s *Memory) Put(_ context.Context, id, data string, expected int64) (Blob, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.m[id]
	if (!ok && expected != 0) || (ok && cur.Version != expected) {
		return Blob{}, ErrConflict
	}
	b := Blob{Data: data, Version: cur.Version + 1, UpdatedAt: time.Now().UTC()}
	s.m[id] = b
	return b, nil
}

func (s *Memory) Delete(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.m, id)
	return nil
}
