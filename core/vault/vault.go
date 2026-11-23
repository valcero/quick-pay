// Package vault provides authenticated encryption for the on-device document.
//
// The Go core never touches disk or the keystore. The host (Keychain /
// Android Keystore / WebCrypto) owns the 32-byte key; Go only seals and opens.
package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
)

const (
	KeySize        = 32
	pbkdf2Iter     = 600_000 // OWASP 2023 guidance for PBKDF2-HMAC-SHA256
	formatPrefix   = "qp1."
	additionalData = "quickpay.v1"
)

var ErrDecrypt = errors.New("could not decrypt: wrong key or corrupted data")

// GenerateKey returns a random 256-bit key, hex encoded.
func GenerateKey() (string, error) {
	k := make([]byte, KeySize)
	if _, err := rand.Read(k); err != nil {
		return "", err
	}
	return hex.EncodeToString(k), nil
}

// DeriveKey derives a key from a passphrase (used for optional web passphrase
// lock and for encrypted sync). salt must be at least 16 bytes.
func DeriveKey(passphrase string, salt []byte) (string, error) {
	if len(salt) < 16 {
		return "", errors.New("salt must be at least 16 bytes")
	}
	k, err := pbkdf2.Key(sha256.New, passphrase, salt, pbkdf2Iter, KeySize)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(k), nil
}

// Seal encrypts plaintext with AES-256-GCM and returns "qp1.<base64(nonce|ct)>".
func Seal(keyHex string, plaintext []byte) (string, error) {
	gcm, err := newGCM(keyHex)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	out := gcm.Seal(nonce, nonce, plaintext, []byte(additionalData))
	return formatPrefix + base64.StdEncoding.EncodeToString(out), nil
}

// Open reverses Seal.
func Open(keyHex, sealed string) ([]byte, error) {
	if len(sealed) <= len(formatPrefix) || sealed[:len(formatPrefix)] != formatPrefix {
		return nil, fmt.Errorf("%w: unknown format", ErrDecrypt)
	}
	raw, err := base64.StdEncoding.DecodeString(sealed[len(formatPrefix):])
	if err != nil {
		return nil, fmt.Errorf("%w: bad encoding", ErrDecrypt)
	}
	gcm, err := newGCM(keyHex)
	if err != nil {
		return nil, err
	}
	if len(raw) < gcm.NonceSize() {
		return nil, ErrDecrypt
	}
	pt, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], []byte(additionalData))
	if err != nil {
		return nil, ErrDecrypt
	}
	return pt, nil
}

func newGCM(keyHex string) (cipher.AEAD, error) {
	k, err := hex.DecodeString(keyHex)
	if err != nil || len(k) != KeySize {
		return nil, errors.New("key must be 32 bytes, hex encoded")
	}
	block, err := aes.NewCipher(k)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
