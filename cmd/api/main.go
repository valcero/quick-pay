// Command api is the OPTIONAL backend. The apps work fully offline without it.
// It only stores client-encrypted blobs for multi-device sync (see migrations/).
//
//	DATABASE_URL=postgres://... go run ./cmd/api   # Postgres
//	go run ./cmd/api                               # in-memory (dev)
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/quickpay/quickpay/internal/syncstore"
)

const maxBody = 64 << 10

var idRe = regexp.MustCompile(`^[0-9a-f]{32}$`)

type server struct{ store syncstore.Store }

func main() {
	var store syncstore.Store = syncstore.NewMemory()
	if url := os.Getenv("DATABASE_URL"); url != "" {
		db, err := sql.Open("pgx", url)
		if err != nil {
			log.Fatal(err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			log.Fatal(err)
		}
		store = syncstore.Postgres{DB: db}
	} else {
		log.Println("DATABASE_URL not set: using in-memory store")
	}
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	srv := &http.Server{
		Addr: addr, Handler: (&server{store}).routes(),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second,
	}
	log.Println("listening on", addr)
	log.Fatal(srv.ListenAndServe())
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("GET /v1/sync/{id}", s.get)
	mux.HandleFunc("PUT /v1/sync/{id}", s.put)
	mux.HandleFunc("DELETE /v1/sync/{id}", s.del)
	return secure(mux)
}

// secure sets headers and CORS. Replace "*" with your web origin in production.
func secure(next http.Handler) http.Handler {
	origin := os.Getenv("ALLOWED_ORIGIN")
	if origin == "" {
		origin = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Allow-Methods", "GET,PUT,DELETE,OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type,If-Match")
		h.Set("Cache-Control", "no-store")
		h.Set("X-Content-Type-Options", "nosniff")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		httpErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	b, err := s.store.Get(r.Context(), id)
	s.respond(w, b, err)
}

// PUT body: {"data":"qp1...."}; If-Match header carries the expected version (0 to create).
func (s *server) put(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		httpErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	expected, err := strconv.ParseInt(r.Header.Get("If-Match"), 10, 64)
	if err != nil || expected < 0 {
		httpErr(w, http.StatusBadRequest, "If-Match must be a non-negative version")
		return
	}
	var body struct {
		Data string `json:"data"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(&body); err != nil ||
		len(body.Data) < 5 || body.Data[:4] != "qp1." {
		httpErr(w, http.StatusBadRequest, "body must be {\"data\":\"qp1....\"} under 64KB")
		return
	}
	b, err := s.store.Put(r.Context(), id, body.Data, expected)
	s.respond(w, b, err)
}

func (s *server) del(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		httpErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.store.Delete(r.Context(), id); err != nil {
		httpErr(w, http.StatusInternalServerError, "server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) respond(w http.ResponseWriter, b syncstore.Blob, err error) {
	switch {
	case errors.Is(err, syncstore.ErrNotFound):
		httpErr(w, http.StatusNotFound, "not found")
	case errors.Is(err, syncstore.ErrConflict):
		httpErr(w, http.StatusConflict, "version conflict")
	case err != nil:
		log.Println("store error:", err) // never log request bodies
		httpErr(w, http.StatusInternalServerError, "server error")
	default:
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(b)
	}
}

func httpErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
