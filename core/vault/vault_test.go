package vault

import (
	"bytes"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	k, _ := GenerateKey()
	s, err := Seal(k, []byte("upi://pay?pa=a@b"))
	if err != nil {
		t.Fatal(err)
	}
	pt, err := Open(k, s)
	if err != nil || !bytes.Equal(pt, []byte("upi://pay?pa=a@b")) {
		t.Fatalf("err=%v pt=%q", err, pt)
	}
}

func TestWrongKeyAndTamper(t *testing.T) {
	k1, _ := GenerateKey()
	k2, _ := GenerateKey()
	s, _ := Seal(k1, []byte("secret"))
	if _, err := Open(k2, s); err == nil {
		t.Fatal("wrong key must fail")
	}
	tampered := s[:len(s)-2] + "AA"
	if tampered == s {
		tampered = s[:len(s)-2] + "BB"
	}
	if _, err := Open(k1, tampered); err == nil {
		t.Fatal("tampered data must fail")
	}
	if _, err := Open(k1, "garbage"); err == nil {
		t.Fatal("bad format must fail")
	}
}

func TestDeriveKeyDeterministic(t *testing.T) {
	salt := bytes.Repeat([]byte{7}, 16)
	a, err := DeriveKey("pass", salt)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := DeriveKey("pass", salt)
	c, _ := DeriveKey("other", salt)
	if a != b || a == c {
		t.Fatal("derivation not deterministic or not passphrase dependent")
	}
	if _, err := DeriveKey("p", []byte("short")); err == nil {
		t.Fatal("short salt must fail")
	}
}
