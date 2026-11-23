// Package presets models the user's saved QR profiles. All operations are pure:
// they take a Document and return a new one, so the same code runs behind WASM,
// gomobile and the server without shared mutable state.
package presets

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/quickpay/quickpay/core/upi"
)

const (
	Version     = 1
	MaxProfiles = 12
	MaxLabelLen = 30
)

var (
	ErrDuplicate = errors.New("this QR is already saved")
	ErrLimit     = errors.New("profile limit reached")
	ErrNotFound  = errors.New("profile not found")
	ErrLabel     = errors.New("label must be 1-30 characters")

	palette = []string{"#58CC02", "#1CB0F6", "#FF9600", "#CE82FF", "#FF4B4B", "#FFC800"}
)

type Profile struct {
	ID        string    `json:"id"`
	Label     string    `json:"label"`
	Payload   string    `json:"payload"` // normalized payload to encode in the QR
	Kind      upi.Kind  `json:"kind"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"createdAt"`
}

type Document struct {
	Version   int       `json:"version"`
	DefaultID string    `json:"defaultId"`
	Profiles  []Profile `json:"profiles"`
}

func New() Document { return Document{Version: Version, Profiles: []Profile{}} }

// Add validates payload, stores it and returns the new document and profile.
// An empty label defaults to the payee name or UPI ID. The first profile
// becomes the default.
func (d Document) Add(label, payload string) (Document, Profile, error) {
	if len(d.Profiles) >= MaxProfiles {
		return d, Profile{}, ErrLimit
	}
	parsed, err := upi.Parse(payload)
	if err != nil {
		return d, Profile{}, err
	}
	for _, p := range d.Profiles {
		if p.Payload == parsed.Normalized {
			return d, Profile{}, ErrDuplicate
		}
	}
	label = strings.TrimSpace(label)
	if label == "" {
		label = parsed.DisplayName
	}
	if n := utf8.RuneCountInString(label); n < 1 || n > MaxLabelLen {
		label = truncate(label, MaxLabelLen)
		if label == "" {
			return d, Profile{}, ErrLabel
		}
	}
	prof := Profile{
		ID: newID(), Label: label, Payload: parsed.Normalized, Kind: parsed.Kind,
		Color: palette[len(d.Profiles)%len(palette)], CreatedAt: time.Now().UTC(),
	}
	out := d.clone()
	out.Profiles = append(out.Profiles, prof)
	if out.DefaultID == "" {
		out.DefaultID = prof.ID
	}
	return out, prof, nil
}

func (d Document) Remove(id string) (Document, error) {
	idx := d.index(id)
	if idx < 0 {
		return d, ErrNotFound
	}
	out := d.clone()
	out.Profiles = append(out.Profiles[:idx], out.Profiles[idx+1:]...)
	if out.DefaultID == id {
		out.DefaultID = ""
		if len(out.Profiles) > 0 {
			out.DefaultID = out.Profiles[0].ID
		}
	}
	return out, nil
}

func (d Document) SetDefault(id string) (Document, error) {
	if d.index(id) < 0 {
		return d, ErrNotFound
	}
	out := d.clone()
	out.DefaultID = id
	return out, nil
}

func (d Document) Rename(id, label string) (Document, error) {
	idx := d.index(id)
	if idx < 0 {
		return d, ErrNotFound
	}
	label = strings.TrimSpace(label)
	if n := utf8.RuneCountInString(label); n < 1 || n > MaxLabelLen {
		return d, ErrLabel
	}
	out := d.clone()
	out.Profiles[idx].Label = label
	return out, nil
}

func (d Document) index(id string) int {
	for i, p := range d.Profiles {
		if p.ID == id {
			return i
		}
	}
	return -1
}

func (d Document) clone() Document {
	out := d
	out.Profiles = append([]Profile{}, d.Profiles...)
	if out.Version == 0 {
		out.Version = Version
	}
	return out
}

func truncate(s string, n int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) > n {
		r = r[:n]
	}
	return string(r)
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
