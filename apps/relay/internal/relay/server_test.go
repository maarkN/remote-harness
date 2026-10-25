package relay

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type harness struct {
	t   *testing.T
	srv *Server
	hs  *httptest.Server
	ws  string
}

func newHarness(t *testing.T, mutate func(*Config)) *harness {
	t.Helper()
	cfg := DefaultConfig()
	cfg.IPBurst = 1000
	cfg.IPRatePerMinute = 60000
	cfg.HandshakeTimeout = time.Second
	if mutate != nil {
		mutate(&cfg)
	}
	srv := New(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	hs := httptest.NewServer(srv.Handler())
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
		hs.Close()
	})
	return &harness{t: t, srv: srv, hs: hs, ws: "ws" + strings.TrimPrefix(hs.URL, "http")}
}

func ctx(t *testing.T) context.Context {
	c, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	return c
}

func (h *harness) dial(path string) (*websocket.Conn, error) {
	c, _, err := websocket.Dial(ctx(h.t), h.ws+path, nil)
	if err == nil {
		c.SetReadLimit(64 << 20)
		// Runs before the harness shuts down, so the relay is not left waiting for close handshakes.
		h.t.Cleanup(func() { c.CloseNow() })
	}
	return c, err
}

// daemon connects and answers the challenge with priv; it returns the connection and the room ID.
func (h *harness) daemon(priv ed25519.PrivateKey) (*websocket.Conn, string) {
	h.t.Helper()
	c, err := h.dial("/v1/daemon")
	if err != nil {
		h.t.Fatal(err)
	}
	challenge := h.read(c)
	if len(challenge) != 1+challengeSize || challenge[0] != frameChallenge {
		h.t.Fatalf("bad challenge %x", challenge)
	}
	h.send(c, SignChallenge(priv, challenge[1:]))
	ready := h.read(c)
	id := DaemonID(priv.Public().(ed25519.PublicKey))
	if ready[0] != frameReady || len(ready) != 17 || !bytes.Equal(ready[1:], mustHex(id)) {
		h.t.Fatalf("bad ready %x", ready)
	}
	return c, id
}

func (h *harness) device(id string) *websocket.Conn {
	h.t.Helper()
	c, err := h.dial("/v1/device/" + id)
	if err != nil {
		h.t.Fatal(err)
	}
	return c
}

func (h *harness) read(c *websocket.Conn) []byte {
	h.t.Helper()
	typ, msg, err := c.Read(ctx(h.t))
	if err != nil {
		h.t.Fatalf("read: %v", err)
	}
	if typ != websocket.MessageBinary {
		h.t.Fatalf("got a text message")
	}
	return msg
}

func (h *harness) send(c *websocket.Conn, msg []byte) {
	h.t.Helper()
	if err := c.Write(ctx(h.t), websocket.MessageBinary, msg); err != nil {
		h.t.Fatalf("write: %v", err)
	}
}

// frame reads one daemon frame and checks its type.
func (h *harness) frame(c *websocket.Conn, kind byte) (uint32, []byte) {
	h.t.Helper()
	f := h.read(c)
	if len(f) < headerSize || f[0] != kind {
		h.t.Fatalf("want frame %#x, got %x", kind, f[:min(len(f), 16)])
	}
	return binary.BigEndian.Uint32(f[1:5]), f[5:]
}

// closed reads until the connection ends and checks the close code.
func (h *harness) closed(c *websocket.Conn, code int) {
	h.t.Helper()
	for {
		_, _, err := c.Read(ctx(h.t))
		if err != nil {
			if got := websocket.CloseStatus(err); int(got) != code {
				h.t.Fatalf("want close %d, got %d (%v)", code, got, err)
			}
			return
		}
	}
}

func key(t *testing.T) ed25519.PrivateKey {
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return priv
}

func TestHealth(t *testing.T) {
	h := newHarness(t, nil)
	res, err := http.Get(h.hs.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || string(body) != `{"status":"ok"}` {
		t.Fatalf("health: %d %s", res.StatusCode, body)
	}
}

func TestBadDaemonID(t *testing.T) {
	h := newHarness(t, nil)
	_, res, err := websocket.Dial(ctx(t), h.ws+"/v1/device/not-an-id", nil)
	if err == nil || res == nil || res.StatusCode != http.StatusBadRequest {
		t.Fatalf("want 400, got %v %v", res, err)
	}
}

func TestRoundTrip(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	dev := h.device(id)
	ch, _ := h.frame(d, frameOpen)
	payload := []byte{0, 1, 2, 0xff, 'n', 'o', 'i', 's', 'e'}
	h.send(dev, payload)
	got, data := h.frame(d, frameData)
	if got != ch || !bytes.Equal(data, payload) {
		t.Fatalf("daemon got %d %x", got, data)
	}
	h.send(d, encodeFrame(frameData, ch, []byte("answer")))
	if msg := h.read(dev); string(msg) != "answer" {
		t.Fatalf("device got %q", msg)
	}
}

func TestTwoDevicesAreIsolated(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	a := h.device(id)
	chA, _ := h.frame(d, frameOpen)
	b := h.device(id)
	chB, _ := h.frame(d, frameOpen)
	if chA == chB {
		t.Fatal("each device needs its own channel")
	}
	h.send(d, encodeFrame(frameData, chB, []byte("for b")))
	h.send(d, encodeFrame(frameData, chA, []byte("for a")))
	if msg := h.read(a); string(msg) != "for a" {
		t.Fatalf("a got %q", msg)
	}
	if msg := h.read(b); string(msg) != "for b" {
		t.Fatalf("b got %q", msg)
	}
}

func TestOrderIsKept(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	dev := h.device(id)
	ch, _ := h.frame(d, frameOpen)
	for i := range 200 {
		h.send(d, encodeFrame(frameData, ch, []byte{byte(i)}))
	}
	for i := range 200 {
		if msg := h.read(dev); msg[0] != byte(i) {
			t.Fatalf("message %d arrived as %d", i, msg[0])
		}
	}
}

func TestForgedSignature(t *testing.T) {
	h := newHarness(t, nil)
	victim, attacker := key(t), key(t)
	c, err := h.dial("/v1/daemon")
	if err != nil {
		t.Fatal(err)
	}
	challenge := h.read(c)
	hello := SignChallenge(attacker, challenge[1:])
	copy(hello[1:33], victim.Public().(ed25519.PublicKey))
	h.send(c, hello)
	h.closed(c, CodeAuthFailed)
	if h.srv.room(DaemonID(victim.Public().(ed25519.PublicKey))) != nil {
		t.Fatal("no room may be opened")
	}
}

func TestOtherKeyGetsItsOwnRoom(t *testing.T) {
	h := newHarness(t, nil)
	owner, _ := h.daemon(key(t))
	_, otherID := h.daemon(key(t))
	h.device(otherID)
	// The device joined the other key's room: the first daemon must not hear of it.
	readCtx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	if _, _, err := owner.Read(readCtx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("the owner received traffic from another room: %v", err)
	}
}

func TestHandshakeDeadline(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.HandshakeTimeout = 100 * time.Millisecond })
	c, err := h.dial("/v1/daemon")
	if err != nil {
		t.Fatal(err)
	}
	h.read(c) // the challenge, never answered
	h.closed(c, CodeHandshakeTimeout)
}

func TestNoDaemon(t *testing.T) {
	h := newHarness(t, nil)
	h.closed(h.device(DaemonID(key(t).Public().(ed25519.PublicKey))), CodeDaemonOffline)
}

func TestDaemonLeaves(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	dev := h.device(id)
	h.frame(d, frameOpen)
	_ = d.Close(websocket.StatusNormalClosure, "")
	h.closed(dev, CodeDaemonOffline)
}

func TestDaemonReconnectReplaces(t *testing.T) {
	h := newHarness(t, nil)
	priv := key(t)
	old, id := h.daemon(priv)
	dev := h.device(id)
	h.frame(old, frameOpen)
	fresh, _ := h.daemon(priv)
	h.closed(old, CodeReplaced)
	h.closed(dev, CodeDaemonOffline)
	again := h.device(id)
	ch, _ := h.frame(fresh, frameOpen)
	h.send(again, []byte("hi"))
	if got, data := h.frame(fresh, frameData); got != ch || string(data) != "hi" {
		t.Fatal("the new connection must own the room")
	}
}

func TestDaemonClosesDevice(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	a := h.device(id)
	chA, _ := h.frame(d, frameOpen)
	b := h.device(id)
	chB, _ := h.frame(d, frameOpen)
	c := h.device(id)
	chC, _ := h.frame(d, frameOpen)
	h.send(d, encodeClose(chA, 4101))
	h.closed(a, 4101)
	h.send(d, encodeClose(chB, 1000))
	h.closed(b, CodeDroppedByDaemon)
	h.send(d, encodeFrame(frameData, chC, []byte("still here")))
	if msg := h.read(c); string(msg) != "still here" {
		t.Fatal("the other device must stay open")
	}
}

func TestDeviceGoneIsReported(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	dev := h.device(id)
	ch, _ := h.frame(d, frameOpen)
	_ = dev.Close(websocket.StatusNormalClosure, "")
	got, rest := h.frame(d, frameClose)
	if got != ch || binary.BigEndian.Uint16(rest) != CodeNormal {
		t.Fatalf("want CLOSE %d 1000, got %d %x", ch, got, rest)
	}
}

func TestTextMessageRefused(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	dev := h.device(id)
	h.frame(d, frameOpen)
	_ = dev.Write(ctx(t), websocket.MessageText, []byte("hello"))
	h.closed(dev, CodeBadFrame)
	_ = d.Write(ctx(t), websocket.MessageText, []byte("hello"))
	h.closed(d, CodeBadFrame)
}

func TestMalformedDaemonFrame(t *testing.T) {
	h := newHarness(t, nil)
	d, _ := h.daemon(key(t))
	h.send(d, []byte{frameData, 0})
	h.closed(d, CodeBadFrame)
}

func TestRoomFull(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.Limits.MaxDevices = 2 })
	d, id := h.daemon(key(t))
	a := h.device(id)
	h.frame(d, frameOpen)
	h.device(id)
	h.frame(d, frameOpen)
	h.closed(h.device(id), CodeRoomFull)
	h.send(a, []byte("ok"))
	h.frame(d, frameData)
}

func TestTenDevicesByDefault(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	for range 10 {
		h.device(id)
		h.frame(d, frameOpen)
	}
	h.closed(h.device(id), CodeRoomFull)
}

func TestIPRateLimit(t *testing.T) {
	h := newHarness(t, func(c *Config) {
		c.IPBurst = 2
		c.IPRatePerMinute = 1
	})
	id := DaemonID(key(t).Public().(ed25519.PublicKey))
	for range 2 {
		if c, err := h.dial("/v1/device/" + id); err != nil {
			t.Fatal(err)
		} else {
			c.CloseNow()
		}
	}
	_, res, err := websocket.Dial(ctx(t), h.ws+"/v1/device/"+id, nil)
	if err == nil || res == nil || res.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("want 429, got %v %v", res, err)
	}
}

func TestIPConcurrencyLimit(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.IPMaxConns = 2 })
	d, id := h.daemon(key(t))
	h.device(id)
	h.frame(d, frameOpen)
	_, res, err := websocket.Dial(ctx(t), h.ws+"/v1/device/"+id, nil)
	if err == nil || res == nil || res.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("want 429, got %v %v", res, err)
	}
}

func TestClientIPHeader(t *testing.T) {
	h := newHarness(t, func(c *Config) {
		c.ClientIPHeader = "Fly-Client-IP"
		c.IPMaxConns = 1
	})
	id := DaemonID(key(t).Public().(ed25519.PublicKey))
	dial := func(ip string) (*http.Response, error) {
		hdr := http.Header{"Fly-Client-IP": {ip}}
		c, res, err := websocket.Dial(ctx(t), h.ws+"/v1/device/"+id, &websocket.DialOptions{HTTPHeader: hdr})
		if err == nil {
			t.Cleanup(func() { c.CloseNow() })
		}
		return res, err
	}
	if _, err := dial("203.0.113.1"); err != nil {
		t.Fatal(err)
	}
	if _, err := dial("203.0.113.2"); err != nil {
		t.Fatal("another client IP has its own limit")
	}
	if res, err := dial("203.0.113.1"); err == nil || res.StatusCode != http.StatusTooManyRequests {
		t.Fatal("the same client IP must be limited")
	}
}

func TestOversizeFrame(t *testing.T) {
	h := newHarness(t, func(c *Config) {
		c.Limits.MaxFrameBytes = 1024
		c.Limits.DeviceQueueBytes = 4096
	})
	d, id := h.daemon(key(t))
	dev := h.device(id)
	ch, _ := h.frame(d, frameOpen)
	_ = dev.Write(ctx(t), websocket.MessageBinary, make([]byte, 2048))
	h.closed(dev, CodeTooBig)
	got, rest := h.frame(d, frameClose)
	if got != ch || binary.BigEndian.Uint16(rest) != CodeTooBig {
		t.Fatalf("want CLOSE 1009 before any DATA, got %d %x", got, rest)
	}
}

func TestDefaultMaxFrameIs8MB(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	dev := h.device(id)
	h.frame(d, frameOpen)
	h.send(dev, make([]byte, 8<<20))
	if _, data := h.frame(d, frameData); len(data) != 8<<20 {
		t.Fatal("an 8 MB message must pass")
	}
	// The relay stops reading mid-message, so the write only ends when the connection does.
	go func() { _ = dev.Write(context.Background(), websocket.MessageBinary, make([]byte, 9<<20)) }()
	h.closed(dev, CodeTooBig)
}

func TestBandwidthSlowsDown(t *testing.T) {
	h := newHarness(t, func(c *Config) {
		c.Limits.RateBytes = 10_000
		c.Limits.BurstBytes = 1_000
	})
	d, id := h.daemon(key(t))
	dev := h.device(id)
	h.frame(d, frameOpen)
	start := time.Now()
	for i := range 5 {
		msg := make([]byte, 1000)
		msg[0] = byte(i)
		h.send(dev, msg)
	}
	for i := range 5 {
		if _, data := h.frame(d, frameData); data[0] != byte(i) {
			t.Fatalf("message %d out of order", i)
		}
	}
	// 5,000 bytes against a 1,000-byte burst at 10,000 B/s: about 400 ms.
	if elapsed := time.Since(start); elapsed < 300*time.Millisecond {
		t.Fatalf("not slowed down: %v", elapsed)
	}
}

func TestIdleTimeout(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.Limits.IdleTimeout = 150 * time.Millisecond })
	d, id := h.daemon(key(t))
	dev := h.device(id)
	ch, _ := h.frame(d, frameOpen)
	h.closed(dev, CodeIdle)
	got, rest := h.frame(d, frameClose)
	if got != ch || binary.BigEndian.Uint16(rest) != CodeIdle {
		t.Fatalf("want CLOSE %d 4010, got %d %x", ch, got, rest)
	}
}

func TestTrafficKeepsDeviceAlive(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.Limits.IdleTimeout = 200 * time.Millisecond })
	d, id := h.daemon(key(t))
	dev := h.device(id)
	ch, _ := h.frame(d, frameOpen)
	for range 6 {
		time.Sleep(60 * time.Millisecond)
		h.send(d, encodeFrame(frameData, ch, []byte("tick")))
		h.read(dev)
	}
}

func TestSlowDeviceDropped(t *testing.T) {
	h := newHarness(t, func(c *Config) {
		c.Limits.MaxFrameBytes = 64 << 10
		c.Limits.DeviceQueueBytes = 64 << 10
	})
	d, id := h.daemon(key(t))
	h.device(id) // never reads
	ch, _ := h.frame(d, frameOpen)
	chunk := make([]byte, 64<<10)
	go func() {
		for range 2000 {
			if d.Write(context.Background(), websocket.MessageBinary, encodeFrame(frameData, ch, chunk)) != nil {
				return
			}
		}
	}()
	for {
		f := h.read(d)
		if f[0] == frameClose {
			if code := binary.BigEndian.Uint16(f[5:]); code != CodeSlowDevice {
				t.Fatalf("want 4031, got %d", code)
			}
			return
		}
	}
}

func TestLivenessPing(t *testing.T) {
	h := newHarness(t, func(c *Config) {
		c.PingInterval = 50 * time.Millisecond
		c.PongTimeout = 50 * time.Millisecond
	})
	_, id := h.daemon(key(t)) // stops reading, so pings are never answered
	deadline := time.Now().Add(3 * time.Second)
	for h.srv.room(id) != nil {
		if time.Now().After(deadline) {
			t.Fatal("an unresponsive daemon must be dropped")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestShutdownTellsBothSidesToReconnect(t *testing.T) {
	h := newHarness(t, nil)
	d, id := h.daemon(key(t))
	dev := h.device(id)
	h.frame(d, frameOpen)
	done := make(chan error, 1)
	go func() { done <- h.srv.Shutdown(ctx(t)) }()
	h.closed(dev, CodeRestart)
	h.closed(d, CodeRestart)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	res, err := http.Get(h.hs.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("health during shutdown: %d", res.StatusCode)
	}
}

type syncBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuffer) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.Write(p)
}

func (s *syncBuffer) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.String()
}

func TestLogsHaveNoPayloadOrIP(t *testing.T) {
	logs := &syncBuffer{}
	h := newHarness(t, nil)
	h.srv.log = slog.New(slog.NewJSONHandler(logs, nil))
	priv := key(t)
	d, id := h.daemon(priv)
	dev := h.device(id)
	ch, _ := h.frame(d, frameOpen)
	h.send(dev, []byte("secret-session-content"))
	h.frame(d, frameData)
	h.send(d, encodeFrame(frameData, ch, []byte("secret-answer")))
	h.read(dev)
	h.daemon(priv)
	h.closed(d, CodeReplaced)
	out := logs.String()
	if !strings.Contains(out, id[:8]) {
		t.Fatalf("expected room events in the logs: %s", out)
	}
	for _, leak := range []string{"secret", "127.0.0.1", id} {
		if strings.Contains(out, leak) {
			t.Fatalf("logs leak %q: %s", leak, out)
		}
	}
}
