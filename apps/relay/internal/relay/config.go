package relay

import (
	"fmt"
	"strconv"
	"time"
)

// Limits apply to one room. They are looked up per daemon ID (Server.LimitsFor) so a future
// subscription can raise them for a given daemon.
type Limits struct {
	// MaxDevices is the number of concurrent device connections in the room.
	MaxDevices int
	// RateBytes and BurstBytes size the room's bandwidth token bucket, shared by both directions.
	RateBytes  int64
	BurstBytes int64
	// MaxFrameBytes is the largest message a device may send (the daemon gets the 5-byte header on top).
	MaxFrameBytes int64
	// DeviceQueueBytes caps what waits to be written to one device before it is dropped as too slow.
	DeviceQueueBytes int64
	// IdleTimeout closes a device channel with no message in either direction.
	IdleTimeout time.Duration
}

// Config is read from the environment (ConfigFromEnv).
type Config struct {
	Addr             string
	Limits           Limits
	HandshakeTimeout time.Duration
	PingInterval     time.Duration
	PongTimeout      time.Duration
	// IPRatePerMinute and IPBurst size the per-IP connection token bucket; IPMaxConns caps open ones.
	IPRatePerMinute float64
	IPBurst         float64
	IPMaxConns      int
	// ClientIPHeader names the proxy header with the client address; empty uses the TCP peer.
	ClientIPHeader  string
	ShutdownTimeout time.Duration
}

// DefaultConfig is what the relay runs with when no variable is set.
func DefaultConfig() Config {
	return Config{
		Addr: ":8080",
		Limits: Limits{
			MaxDevices:       10,
			RateBytes:        1 << 20,
			BurstBytes:       64 << 20,
			MaxFrameBytes:    8 << 20,
			DeviceQueueBytes: 16 << 20,
			IdleTimeout:      10 * time.Minute,
		},
		HandshakeTimeout: 10 * time.Second,
		PingInterval:     25 * time.Second,
		PongTimeout:      20 * time.Second,
		IPRatePerMinute:  60,
		IPBurst:          20,
		IPMaxConns:       64,
		ShutdownTimeout:  10 * time.Second,
	}
}

// ConfigFromEnv overrides DefaultConfig with the RELAY_* variables that are set.
func ConfigFromEnv(getenv func(string) string) (Config, error) {
	c := DefaultConfig()
	p := envParser{getenv: getenv}
	if v := getenv("RELAY_ADDR"); v != "" {
		c.Addr = v
	}
	p.int("RELAY_MAX_DEVICES", &c.Limits.MaxDevices)
	p.bytes("RELAY_ROOM_RATE_BYTES", &c.Limits.RateBytes)
	p.bytes("RELAY_ROOM_BURST_BYTES", &c.Limits.BurstBytes)
	p.bytes("RELAY_MAX_FRAME_BYTES", &c.Limits.MaxFrameBytes)
	p.bytes("RELAY_DEVICE_QUEUE_BYTES", &c.Limits.DeviceQueueBytes)
	p.duration("RELAY_IDLE_TIMEOUT", &c.Limits.IdleTimeout)
	p.duration("RELAY_HANDSHAKE_TIMEOUT", &c.HandshakeTimeout)
	p.duration("RELAY_PING_INTERVAL", &c.PingInterval)
	p.duration("RELAY_PONG_TIMEOUT", &c.PongTimeout)
	p.float("RELAY_IP_CONNECTS_PER_MINUTE", &c.IPRatePerMinute)
	p.float("RELAY_IP_BURST", &c.IPBurst)
	p.int("RELAY_IP_MAX_CONNS", &c.IPMaxConns)
	p.duration("RELAY_SHUTDOWN_TIMEOUT", &c.ShutdownTimeout)
	c.ClientIPHeader = getenv("RELAY_CLIENT_IP_HEADER")
	if p.err != nil {
		return Config{}, p.err
	}
	if c.Limits.DeviceQueueBytes < c.Limits.MaxFrameBytes {
		return Config{}, fmt.Errorf("RELAY_DEVICE_QUEUE_BYTES must be at least RELAY_MAX_FRAME_BYTES")
	}
	return c, nil
}

type envParser struct {
	getenv func(string) string
	err    error
}

func (p *envParser) lookup(name string) (string, bool) {
	v := p.getenv(name)
	return v, v != "" && p.err == nil
}

func (p *envParser) int(name string, dst *int) {
	if v, ok := p.lookup(name); ok {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			p.err = fmt.Errorf("%s must be a positive integer, got %q", name, v)
			return
		}
		*dst = n
	}
}

func (p *envParser) bytes(name string, dst *int64) {
	if v, ok := p.lookup(name); ok {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			p.err = fmt.Errorf("%s must be a positive number of bytes, got %q", name, v)
			return
		}
		*dst = n
	}
}

func (p *envParser) float(name string, dst *float64) {
	if v, ok := p.lookup(name); ok {
		n, err := strconv.ParseFloat(v, 64)
		if err != nil || n <= 0 {
			p.err = fmt.Errorf("%s must be a positive number, got %q", name, v)
			return
		}
		*dst = n
	}
}

func (p *envParser) duration(name string, dst *time.Duration) {
	if v, ok := p.lookup(name); ok {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 {
			p.err = fmt.Errorf("%s must be a positive duration such as 10s, got %q", name, v)
			return
		}
		*dst = d
	}
}
