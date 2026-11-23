package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/quickpay/quickpay/internal/syncstore"
)

func do(h http.Handler, method, path, match, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if match != "" {
		r.Header.Set("If-Match", match)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestSyncLifecycle(t *testing.T) {
	h := (&server{syncstore.NewMemory()}).routes()
	p := "/v1/sync/" + strings.Repeat("ab", 16)
	if w := do(h, "GET", p, "", ""); w.Code != 404 {
		t.Fatalf("get missing: %d", w.Code)
	}
	if w := do(h, "PUT", p, "0", `{"data":"qp1.AAAA"}`); w.Code != 200 {
		t.Fatalf("create: %d", w.Code)
	}
	if w := do(h, "PUT", p, "0", `{"data":"qp1.BBBB"}`); w.Code != 409 {
		t.Fatalf("stale write should conflict: %d", w.Code)
	}
	if w := do(h, "PUT", p, "1", `{"data":"plaintext"}`); w.Code != 400 {
		t.Fatalf("non-ciphertext must be rejected: %d", w.Code)
	}
	if w := do(h, "PUT", p, "1", `{"data":"qp1.CCCC"}`); w.Code != 200 {
		t.Fatalf("update: %d", w.Code)
	}
	if w := do(h, "GET", "/v1/sync/short", "", ""); w.Code != 400 {
		t.Fatalf("bad id: %d", w.Code)
	}
	if w := do(h, "DELETE", p, "", ""); w.Code != 204 {
		t.Fatalf("delete: %d", w.Code)
	}
}
