package relay

import (
	"crypto/ed25519"
	"crypto/rand"
	"strings"
	"testing"
	"time"
)

func TestConfigDefaults(t *testing.T) {
	c, err := ConfigFromEnv(func(string) string { return "" })
	if err != nil {
		t.Fatal(err)
	}
	if c.Limits.MaxDevices != 10 || c.Limits.MaxFrameBytes != 8<<20 || c.Addr != ":8080" {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

func TestConfigOverrides(t *testing.T) {
	env := map[string]string{
		"RELAY_MAX_DEVICES":        "3",
		"RELAY_IDLE_TIMEOUT":       "90s",
		"RELAY_IP_BURST":           "5",
		"RELAY_CLIENT_IP_HEADER":   "Fly-Client-IP",
		"RELAY_DEVICE_QUEUE_BYTES": "9000000",
	}
	c, err := ConfigFromEnv(func(k string) string { return env[k] })
	if err != nil {
		t.Fatal(err)
	}
	if c.Limits.MaxDevices != 3 || c.Limits.IdleTimeout != 90*time.Second || c.IPBurst != 5 ||
		c.ClientIPHeader != "Fly-Client-IP" || c.Limits.DeviceQueueBytes != 9000000 {
		t.Fatalf("overrides not applied: %+v", c)
	}
}

func TestConfigRejectsBadValues(t *testing.T) {
	for _, kv := range [][2]string{
		{"RELAY_MAX_DEVICES", "0"},
		{"RELAY_MAX_DEVICES", "ten"},
		{"RELAY_IDLE_TIMEOUT", "10"},
		{"RELAY_ROOM_RATE_BYTES", "-1"},
		{"RELAY_DEVICE_QUEUE_BYTES", "1024"},
	} {
		_, err := ConfigFromEnv(func(k string) string {
			if k == kv[0] {
				return kv[1]
			}
			return ""
		})
		if err == nil || !strings.Contains(err.Error(), "RELAY_") {
			t.Errorf("%s=%s: want an error naming the variable, got %v", kv[0], kv[1], err)
		}
	}
}

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func TestBucketDelaysInsteadOfRefusing(t *testing.T) {
	clk := &fakeClock{t: time.Unix(0, 0)}
	b := newBucket(100, 100, clk.now())
	if d := b.take(100, clk.now()); d != 0 {
		t.Fatalf("burst should pass, waited %v", d)
	}
	if d := b.take(50, clk.now()); d != 500*time.Millisecond {
		t.Fatalf("50 tokens of debt at 100/s is 500ms, got %v", d)
	}
	clk.advance(time.Second)
	if d := b.take(40, clk.now()); d != 0 {
		t.Fatalf("debt should be repaid after a second, waited %v", d)
	}
}

func TestIPLimiterRateAndConcurrency(t *testing.T) {
	clk := &fakeClock{t: time.Unix(0, 0)}
	l := newIPLimiter(60, 2, 3, clk.now)
	if !l.acquire("a") || !l.acquire("a") {
		t.Fatal("burst of 2 should pass")
	}
	if l.acquire("a") {
		t.Fatal("third connection within the second should be refused")
	}
	if !l.acquire("b") {
		t.Fatal("another IP has its own bucket")
	}
	clk.advance(time.Second)
	if !l.acquire("a") {
		t.Fatal("one token per second at 60/min")
	}
	clk.advance(10 * time.Second)
	if l.acquire("a") {
		t.Fatal("three open connections is the cap")
	}
}

func TestIPLimiterForgetsIdleIPs(t *testing.T) {
	clk := &fakeClock{t: time.Unix(0, 0)}
	l := newIPLimiter(60, 2, 3, clk.now)
	l.acquire("a")
	l.release("a")
	if l.size() != 1 {
		t.Fatal("bucket not full yet, entry must stay to keep the rate")
	}
	clk.advance(2 * time.Second)
	l.sweep()
	if l.size() != 0 {
		t.Fatal("an IP with no connection and a full bucket must be forgotten")
	}
}

func TestBandwidthKeptAcrossReconnects(t *testing.T) {
	clk := &fakeClock{t: time.Unix(0, 0)}
	bw := newBandwidth(clk.now)
	l := Limits{RateBytes: 10, BurstBytes: 10}
	e := bw.acquire("room", l)
	e.bucket.take(10, clk.now())
	bw.release(e)
	bw.sweep()
	if bw.size() != 1 {
		t.Fatal("an empty bucket must survive the reconnect")
	}
	if again := bw.acquire("room", l); again != e {
		t.Fatal("the reconnecting daemon must get the same bucket")
	}
	bw.release(e)
	clk.advance(2 * time.Second)
	bw.sweep()
	if bw.size() != 0 {
		t.Fatal("a full unused bucket must be dropped")
	}
}

func TestHelloSignature(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	challenge := make([]byte, challengeSize)
	_, _ = rand.Read(challenge)
	hello := SignChallenge(priv, challenge)
	id, ok := verifyHello(hello, challenge)
	if !ok || id != DaemonID(pub) || !validDaemonID(id) {
		t.Fatalf("valid hello refused: %v %s", ok, id)
	}
	other := make([]byte, challengeSize)
	if _, ok := verifyHello(hello, other); ok {
		t.Fatal("a signature over another challenge must fail")
	}
	tampered := append([]byte{}, hello...)
	tampered[5] ^= 1
	if _, ok := verifyHello(tampered, challenge); ok {
		t.Fatal("a different public key must fail")
	}
	if _, ok := verifyHello(hello[:helloSize-1], challenge); ok {
		t.Fatal("a short hello must fail")
	}
}

func TestDaemonIDFormat(t *testing.T) {
	// SHA-256 of 32 zero bytes starts with 66687aadf862bd776c8fc18b8e9f8e20.
	if got := DaemonID(make([]byte, 32)); got != "66687aadf862bd776c8fc18b8e9f8e20" {
		t.Fatalf("daemon ID = %s", got)
	}
	for _, bad := range []string{"", "66687AADF862BD776C8FC18B8E9F8E20", "66687aadf862bd776c8fc18b8e9f8e2", "../../etc"} {
		if validDaemonID(bad) {
			t.Errorf("%q must be refused", bad)
		}
	}
}

func TestFrames(t *testing.T) {
	f := encodeFrame(frameData, 7, []byte("abc"))
	kind, ch, rest, err := decodeFrame(f)
	if err != nil || kind != frameData || ch != 7 || string(rest) != "abc" {
		t.Fatalf("round trip failed: %v %d %d %q", err, kind, ch, rest)
	}
	kind, ch, rest, err = decodeFrame(encodeClose(9, 4101))
	if err != nil || kind != frameClose || ch != 9 || len(rest) != 2 {
		t.Fatalf("close round trip failed: %v", err)
	}
	for _, bad := range [][]byte{{frameData, 0, 0}, encodeFrame(frameOpen, 1, nil), encodeFrame(frameClose, 1, []byte{1}), encodeFrame(0x7f, 1, nil)} {
		if _, _, _, err := decodeFrame(bad); err == nil {
			t.Errorf("frame %x must be refused", bad)
		}
	}
	if deviceCloseCode(4101) != 4101 || deviceCloseCode(1000) != CodeDroppedByDaemon || deviceCloseCode(4200) != CodeDroppedByDaemon {
		t.Fatal("only 4100-4199 pass through")
	}
}
