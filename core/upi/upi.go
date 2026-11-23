// Package upi parses and validates "receive money" QR payloads.
//
// Supported kinds:
//   - upi:     upi://pay?pa=...&pn=...   (NPCI deep-link spec)
//   - emv:     EMVCo merchant-presented QR (starts with "000201", CRC16 verified)
//   - generic: any other non-empty text/URL. Stored and rendered as-is so users
//     in other countries or with bank-specific QR formats are not blocked.
package upi

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

type Kind string

const (
	KindUPI     Kind = "upi"
	KindEMV     Kind = "emv"
	KindGeneric Kind = "generic"
)

const MaxPayloadLen = 2048

var (
	ErrEmpty    = errors.New("payload is empty")
	ErrTooLong  = errors.New("payload is too long")
	ErrInvalid  = errors.New("payload is invalid")
	vpaRe       = regexp.MustCompile(`^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$`)
	amountRe    = regexp.MustCompile(`^\d{1,9}(\.\d{1,2})?$`)
	controlChar = regexp.MustCompile(`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`)
)

// Parsed is the result of validating a payload. Normalized is what should be
// encoded into the QR image.
type Parsed struct {
	Kind         Kind     `json:"kind"`
	Normalized   string   `json:"normalized"`
	VPA          string   `json:"vpa,omitempty"`
	PayeeName    string   `json:"payeeName,omitempty"`
	Amount       string   `json:"amount,omitempty"`
	Currency     string   `json:"currency,omitempty"`
	Note         string   `json:"note,omitempty"`
	MerchantCode string   `json:"merchantCode,omitempty"`
	DisplayName  string   `json:"displayName"`
	Warnings     []string `json:"warnings,omitempty"`
}

// Parse validates raw and returns its structured form.
func Parse(raw string) (Parsed, error) {
	s := strings.TrimSpace(raw)
	switch {
	case s == "":
		return Parsed{}, ErrEmpty
	case len(s) > MaxPayloadLen:
		return Parsed{}, ErrTooLong
	case controlChar.MatchString(s):
		return Parsed{}, fmt.Errorf("%w: control characters", ErrInvalid)
	}
	lower := strings.ToLower(s)
	switch {
	case strings.HasPrefix(lower, "upi:"):
		return parseUPI(s)
	case strings.HasPrefix(s, "000201"):
		return parseEMV(s)
	default:
		return Parsed{
			Kind: KindGeneric, Normalized: s, DisplayName: "Payment QR",
			Warnings: []string{"Format not recognised. It will be shown exactly as saved."},
		}, nil
	}
}

func parseUPI(s string) (Parsed, error) {
	u, err := url.Parse(s)
	if err != nil || !strings.EqualFold(u.Scheme, "upi") || !strings.EqualFold(u.Host, "pay") {
		return Parsed{}, fmt.Errorf("%w: expected upi://pay?...", ErrInvalid)
	}
	q := u.Query()
	p := Parsed{
		Kind:         KindUPI,
		VPA:          strings.TrimSpace(q.Get("pa")),
		PayeeName:    strings.TrimSpace(q.Get("pn")),
		Amount:       strings.TrimSpace(q.Get("am")),
		Currency:     strings.ToUpper(strings.TrimSpace(q.Get("cu"))),
		Note:         strings.TrimSpace(q.Get("tn")),
		MerchantCode: strings.TrimSpace(q.Get("mc")),
	}
	if !vpaRe.MatchString(p.VPA) {
		return Parsed{}, fmt.Errorf("%w: missing or malformed UPI ID (pa)", ErrInvalid)
	}
	if p.Currency != "" && p.Currency != "INR" {
		return Parsed{}, fmt.Errorf("%w: UPI supports INR only", ErrInvalid)
	}
	if p.Amount != "" {
		if !amountRe.MatchString(p.Amount) {
			return Parsed{}, fmt.Errorf("%w: malformed amount", ErrInvalid)
		}
		if f, _ := strconv.ParseFloat(p.Amount, 64); f <= 0 {
			return Parsed{}, fmt.Errorf("%w: amount must be positive", ErrInvalid)
		}
		p.Warnings = append(p.Warnings, "This QR has a fixed amount. Payers cannot change it.")
	}
	if q.Get("tr") != "" {
		p.Warnings = append(p.Warnings, "This QR has a transaction reference, which is meant for a single payment.")
	}
	p.Normalized = BuildUPI(p.VPA, p.PayeeName, p.Amount, p.Note)
	p.DisplayName = firstNonEmpty(p.PayeeName, p.VPA)
	return p, nil
}

// BuildUPI builds a canonical upi://pay URI. Empty fields are omitted.
func BuildUPI(vpa, name, amount, note string) string {
	v := url.Values{}
	v.Set("pa", vpa)
	if name != "" {
		v.Set("pn", name)
	}
	if amount != "" {
		v.Set("am", amount)
	}
	v.Set("cu", "INR")
	if note != "" {
		v.Set("tn", note)
	}
	// url.Values.Encode sorts keys and uses '+' for spaces; UPI apps expect %20.
	return "upi://pay?" + strings.ReplaceAll(v.Encode(), "+", "%20")
}

func parseEMV(s string) (Parsed, error) {
	if len(s) < 12 {
		return Parsed{}, fmt.Errorf("%w: EMV payload too short", ErrInvalid)
	}
	body, crc := s[:len(s)-4], strings.ToUpper(s[len(s)-4:])
	if !strings.HasSuffix(body, "6304") {
		return Parsed{}, fmt.Errorf("%w: missing CRC tag 63", ErrInvalid)
	}
	if want := fmt.Sprintf("%04X", crc16(body)); want != crc {
		return Parsed{}, fmt.Errorf("%w: CRC mismatch (expected %s)", ErrInvalid, want)
	}
	tags, err := parseTLV(s)
	if err != nil {
		return Parsed{}, err
	}
	name := tags["59"]
	p := Parsed{Kind: KindEMV, Normalized: s, PayeeName: name, Currency: tags["53"], DisplayName: firstNonEmpty(name, "Payment QR")}
	if tags["54"] != "" {
		p.Amount = tags["54"]
		p.Warnings = append(p.Warnings, "This QR has a fixed amount. Payers cannot change it.")
	}
	return p, nil
}

func parseTLV(s string) (map[string]string, error) {
	out := map[string]string{}
	for i := 0; i < len(s); {
		if i+4 > len(s) {
			return nil, fmt.Errorf("%w: truncated EMV field", ErrInvalid)
		}
		tag := s[i : i+2]
		n, err := strconv.Atoi(s[i+2 : i+4])
		if err != nil || i+4+n > len(s) {
			return nil, fmt.Errorf("%w: bad EMV length at offset %d", ErrInvalid, i)
		}
		out[tag] = s[i+4 : i+4+n]
		i += 4 + n
	}
	return out, nil
}

// crc16 is CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) as required by EMVCo.
func crc16(s string) uint16 {
	crc := uint16(0xFFFF)
	for i := 0; i < len(s); i++ {
		crc ^= uint16(s[i]) << 8
		for b := 0; b < 8; b++ {
			if crc&0x8000 != 0 {
				crc = crc<<1 ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if s != "" {
			return s
		}
	}
	return ""
}
