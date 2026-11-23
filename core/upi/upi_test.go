package upi

import (
	"fmt"
	"testing"
)

func TestParseUPI(t *testing.T) {
	p, err := Parse("UPI://pay?pa=asha@okbank&pn=Asha%20K&cu=INR")
	if err != nil {
		t.Fatal(err)
	}
	if p.Kind != KindUPI || p.VPA != "asha@okbank" || p.PayeeName != "Asha K" {
		t.Fatalf("unexpected: %+v", p)
	}
	if want := "upi://pay?cu=INR&pa=asha%40okbank&pn=Asha%20K"; p.Normalized != want {
		t.Fatalf("normalized %q want %q", p.Normalized, want)
	}
	if len(p.Warnings) != 0 {
		t.Fatalf("unexpected warnings %v", p.Warnings)
	}
}

func TestParseUPIErrors(t *testing.T) {
	for _, in := range []string{
		"", "upi://pay?pn=NoVPA", "upi://pay?pa=bad", "upi://pay?pa=a@b",
		"upi://pay?pa=asha@okbank&cu=USD", "upi://pay?pa=asha@okbank&am=-5",
		"upi://pay?pa=asha@okbank&am=0", "upi://collect?pa=asha@okbank",
	} {
		if _, err := Parse(in); err == nil {
			t.Errorf("expected error for %q", in)
		}
	}
}

func TestFixedAmountWarns(t *testing.T) {
	p, err := Parse("upi://pay?pa=asha@okbank&am=100.50&tr=ABC")
	if err != nil || len(p.Warnings) != 2 {
		t.Fatalf("err=%v warnings=%v", err, p.Warnings)
	}
}

func emv(body string) string { return body + fmt.Sprintf("%04X", crc16(body)) }

func TestEMV(t *testing.T) {
	good := emv("000201010211" + "5909Asha Shop" + "5303356" + "6304")
	p, err := Parse(good)
	if err != nil || p.Kind != KindEMV || p.PayeeName != "Asha Shop" {
		t.Fatalf("err=%v p=%+v", err, p)
	}
	bad := good[:len(good)-1] + "0"
	if good[len(good)-1] == '0' {
		bad = good[:len(good)-1] + "1"
	}
	if _, err := Parse(bad); err == nil {
		t.Fatal("expected CRC error")
	}
}

func TestCRCKnownVector(t *testing.T) {
	if got := crc16("123456789"); got != 0x29B1 {
		t.Fatalf("crc16 = %04X", got)
	}
}

func TestGenericAndLimits(t *testing.T) {
	if p, err := Parse("https://pay.example/abc"); err != nil || p.Kind != KindGeneric {
		t.Fatalf("%v %+v", err, p)
	}
	long := make([]byte, MaxPayloadLen+1)
	for i := range long {
		long[i] = 'a'
	}
	if _, err := Parse(string(long)); err != ErrTooLong {
		t.Fatalf("want ErrTooLong got %v", err)
	}
	if _, err := Parse("abc\x00def"); err == nil {
		t.Fatal("control chars must be rejected")
	}
}
