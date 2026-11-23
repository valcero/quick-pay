package presets

import "testing"

const a = "upi://pay?pa=asha@okbank&pn=Asha"
const b = "upi://pay?pa=ravi@oksbi"

func TestAddDefaultsAndDuplicates(t *testing.T) {
	d, p1, err := New().Add("", a)
	if err != nil || p1.Label != "Asha" || d.DefaultID != p1.ID {
		t.Fatalf("err=%v d=%+v", err, d)
	}
	if _, _, err := d.Add("again", a); err != ErrDuplicate {
		t.Fatalf("want duplicate, got %v", err)
	}
	d2, p2, err := d.Add("Shop", b)
	if err != nil || d2.DefaultID != p1.ID || len(d.Profiles) != 1 {
		t.Fatalf("immutability or default broken: %v %+v", err, d)
	}
	d3, err := d2.SetDefault(p2.ID)
	if err != nil || d3.DefaultID != p2.ID {
		t.Fatal("set default failed")
	}
	d4, _ := d3.Remove(p2.ID)
	if d4.DefaultID != p1.ID || len(d4.Profiles) != 1 {
		t.Fatalf("default not reassigned: %+v", d4)
	}
	if _, err := d4.Remove("nope"); err != ErrNotFound {
		t.Fatal("want not found")
	}
}

func TestLimitAndInvalid(t *testing.T) {
	d := New()
	for i := 0; i < MaxProfiles; i++ {
		var err error
		d, _, err = d.Add("x", "https://x.example/"+string(rune('a'+i)))
		if err != nil {
			t.Fatal(err)
		}
	}
	if _, _, err := d.Add("x", "https://x.example/zz"); err != ErrLimit {
		t.Fatalf("want limit, got %v", err)
	}
	if _, _, err := New().Add("x", "upi://pay?pa=bad"); err == nil {
		t.Fatal("invalid payload accepted")
	}
}
