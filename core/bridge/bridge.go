// Package bridge is the single, string-in/string-out surface of the Go core.
//
// Every function uses only string, []byte-free signatures and (string, error)
// returns, which is what both `gomobile bind` (Android/iOS) and the
// syscall/js WASM wrapper (web) can export. Documents travel as JSON.
package bridge

import (
	"encoding/json"

	"github.com/quickpay/quickpay/core/presets"
	"github.com/quickpay/quickpay/core/upi"
	"github.com/quickpay/quickpay/core/vault"
)

func toJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	return string(b), err
}

func loadDoc(doc string) (presets.Document, error) {
	if doc == "" {
		return presets.New(), nil
	}
	var d presets.Document
	if err := json.Unmarshal([]byte(doc), &d); err != nil {
		return d, err
	}
	if d.Profiles == nil {
		d.Profiles = []presets.Profile{}
	}
	return d, nil
}

// ParseQR validates a payload and returns upi.Parsed as JSON.
func ParseQR(payload string) (string, error) {
	p, err := upi.Parse(payload)
	if err != nil {
		return "", err
	}
	return toJSON(p)
}

func BuildUPI(vpa, name, amount, note string) (string, error) {
	p, err := upi.Parse(upi.BuildUPI(vpa, name, amount, note))
	if err != nil {
		return "", err
	}
	return p.Normalized, nil
}

func NewDocument() (string, error) { return toJSON(presets.New()) }

func AddProfile(doc, label, payload string) (string, error) {
	d, err := loadDoc(doc)
	if err != nil {
		return "", err
	}
	out, _, err := d.Add(label, payload)
	if err != nil {
		return "", err
	}
	return toJSON(out)
}

func RemoveProfile(doc, id string) (string, error) {
	d, err := loadDoc(doc)
	if err != nil {
		return "", err
	}
	out, err := d.Remove(id)
	if err != nil {
		return "", err
	}
	return toJSON(out)
}

func SetDefaultProfile(doc, id string) (string, error) {
	d, err := loadDoc(doc)
	if err != nil {
		return "", err
	}
	out, err := d.SetDefault(id)
	if err != nil {
		return "", err
	}
	return toJSON(out)
}

func RenameProfile(doc, id, label string) (string, error) {
	d, err := loadDoc(doc)
	if err != nil {
		return "", err
	}
	out, err := d.Rename(id, label)
	if err != nil {
		return "", err
	}
	return toJSON(out)
}

func GenerateKey() (string, error) { return vault.GenerateKey() }

// DeriveKey derives a key from a passphrase and a hex-free salt string
// (>= 16 bytes), used for optional passphrase lock and encrypted sync.
func DeriveKey(passphrase, salt string) (string, error) {
	return vault.DeriveKey(passphrase, []byte(salt))
}

// SealDocument validates doc JSON then encrypts it.
func SealDocument(keyHex, doc string) (string, error) {
	if _, err := loadDoc(doc); err != nil {
		return "", err
	}
	return vault.Seal(keyHex, []byte(doc))
}

// OpenDocument decrypts and validates a sealed document, returning JSON.
func OpenDocument(keyHex, sealed string) (string, error) {
	pt, err := vault.Open(keyHex, sealed)
	if err != nil {
		return "", err
	}
	if _, err := loadDoc(string(pt)); err != nil {
		return "", err
	}
	return string(pt), nil
}
