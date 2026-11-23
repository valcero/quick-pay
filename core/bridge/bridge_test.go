package bridge

import (
	"strings"
	"testing"
)

func TestEndToEnd(t *testing.T) {
	doc, _ := NewDocument()
	doc, err := AddProfile(doc, "Me", "upi://pay?pa=asha@okbank")
	if err != nil {
		t.Fatal(err)
	}
	key, _ := GenerateKey()
	sealed, err := SealDocument(key, doc)
	if err != nil || strings.Contains(sealed, "asha") {
		t.Fatalf("err=%v sealed leaks plaintext", err)
	}
	got, err := OpenDocument(key, sealed)
	if err != nil || got != doc {
		t.Fatalf("roundtrip failed: %v", err)
	}
}
