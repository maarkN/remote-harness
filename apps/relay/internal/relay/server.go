// Package relay is the connection relay: it forwards end-to-end encrypted messages between a
// daemon and its devices without being able to read them (ADR-0001, ADR-0003).
//
// A daemon connects to /v1/daemon, answers a challenge with its Ed25519 relay key and owns the
// room named by its daemon ID. A device connects to /v1/device/<daemon ID>; each device message
// reaches the daemon as a DATA frame on the device's channel, and back.
package relay

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
)

const (
	writeTimeout  = 30 * time.Second
	sweepInterval = time.Minute
)

var acceptOptions = &websocket.AcceptOptions{
	// Devices are apps, not browsers, and every byte is authenticated end to end.
	InsecureSkipVerify: true,
	CompressionMode:    websocket.CompressionDisabled,
}

// Server holds the rooms. Create it with New, serve Handler and call Shutdown on exit.
type Server struct {
	cfg Config
	// LimitsFor returns the limits of a daemon's room; by default the configured ones for all.
	LimitsFor func(daemonID string) Limits
	log       *slog.Logger
	now       func() time.Time
	ips       *ipLimiter
	bw        *bandwidth

	base   context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	mu      sync.Mutex
	rooms   map[string]*room
	peers   map[*peer]struct{}
	closing bool
}

// New starts the background sweeper; Shutdown stops it.
func New(cfg Config, log *slog.Logger) *Server {
	base, cancel := context.WithCancel(context.Background())
	s := &Server{
		cfg:    cfg,
		log:    log,
		now:    time.Now,
		base:   base,
		cancel: cancel,
		rooms:  map[string]*room{},
		peers:  map[*peer]struct{}{},
	}
	s.LimitsFor = func(string) Limits { return cfg.Limits }
	s.ips = newIPLimiter(cfg.IPRatePerMinute, cfg.IPBurst, cfg.IPMaxConns, s.now)
	s.bw = newBandwidth(s.now)
	go s.sweepLoop()
	return s
}

// Handler serves /healthz, /v1/daemon and /v1/device/{id}.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /v1/daemon", s.handleDaemon)
	mux.HandleFunc("GET /v1/device/{id}", s.handleDevice)
	return mux
}

// Shutdown closes every connection with 1012 so both sides reconnect, and waits for them.
func (s *Server) Shutdown(ctx context.Context) error {
	s.mu.Lock()
	s.closing = true
	peers := make([]*peer, 0, len(s.peers))
	for p := range s.peers {
		peers = append(peers, p)
	}
	s.mu.Unlock()
	s.log.Info("relay stopping", "connections", len(peers))
	for _, p := range peers {
		p.close(CodeRestart, "relay restarting")
	}
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()
	defer s.cancel()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if s.isClosing() {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"status":"stopping"}`))
		return
	}
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (s *Server) isClosing() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.closing
}

// admit applies the per-IP limits before the upgrade. The caller releases the IP when it returns true.
func (s *Server) admit(w http.ResponseWriter, ip string) bool {
	if s.isClosing() {
		http.Error(w, "relay restarting", http.StatusServiceUnavailable)
		return false
	}
	if !s.ips.acquire(ip) {
		s.log.Warn("ip limit hit")
		http.Error(w, "too many connections", http.StatusTooManyRequests)
		return false
	}
	return true
}

func (s *Server) clientIP(r *http.Request) string {
	if h := s.cfg.ClientIPHeader; h != "" {
		if v := strings.TrimSpace(strings.Split(r.Header.Get(h), ",")[0]); v != "" {
			return v
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// accept upgrades the request and tracks the connection for Shutdown; nil when shutting down.
func (s *Server) accept(w http.ResponseWriter, r *http.Request) *peer {
	c, err := websocket.Accept(w, r, acceptOptions)
	if err != nil {
		return nil
	}
	ctx, cancel := context.WithCancel(s.base)
	p := &peer{conn: c, ctx: ctx, cancel: cancel}
	s.mu.Lock()
	closing := s.closing
	if !closing {
		s.peers[p] = struct{}{}
	}
	s.mu.Unlock()
	if closing {
		p.close(CodeRestart, "relay restarting")
		p.drain()
		cancel()
		return nil
	}
	return p
}

func (s *Server) untrack(p *peer) {
	s.mu.Lock()
	delete(s.peers, p)
	s.mu.Unlock()
	p.cancel()
}

// keepAlive pings the peer and closes it when a pong does not come back in time.
func (s *Server) keepAlive(p *peer) {
	t := time.NewTicker(s.cfg.PingInterval)
	defer t.Stop()
	for {
		select {
		case <-p.ctx.Done():
			return
		case <-t.C:
			ctx, cancel := context.WithTimeout(p.ctx, s.cfg.PongTimeout)
			err := p.conn.Ping(ctx)
			cancel()
			if err != nil {
				if p.ctx.Err() == nil {
					p.conn.CloseNow()
				}
				return
			}
		}
	}
}

func (s *Server) sweepLoop() {
	t := time.NewTicker(sweepInterval)
	defer t.Stop()
	for {
		select {
		case <-s.base.Done():
			return
		case <-t.C:
			s.ips.sweep()
			s.bw.sweep()
		}
	}
}

func (s *Server) handleDaemon(w http.ResponseWriter, r *http.Request) {
	ip := s.clientIP(r)
	if !s.admit(w, ip) {
		return
	}
	defer s.ips.release(ip)
	s.wg.Add(1)
	defer s.wg.Done()
	p := s.accept(w, r)
	if p == nil {
		return
	}
	defer s.untrack(p)
	go s.keepAlive(p)

	id, ok := s.authenticate(p)
	if !ok {
		p.drain()
		return
	}
	limits := s.LimitsFor(id)
	p.conn.SetReadLimit(limits.MaxFrameBytes + headerSize)
	rm := s.openRoom(id, limits, p)
	defer s.closeRoom(rm)
	ready := append([]byte{frameReady}, mustHex(id)...)
	if err := p.write(ready); err != nil {
		return
	}

	for {
		typ, f, err := p.conn.Read(p.ctx)
		if err != nil {
			return
		}
		if p.closing.Load() {
			continue
		}
		if typ != websocket.MessageBinary {
			p.close(CodeBadFrame, "binary frames only")
			continue
		}
		kind, channel, rest, err := decodeFrame(f)
		if err != nil {
			p.close(CodeBadFrame, "malformed frame")
			continue
		}
		dev := rm.device(channel)
		if dev == nil {
			// The device left while this frame was in flight; its CLOSE is on the way.
			continue
		}
		switch kind {
		case frameData:
			if err := s.bw.wait(p.ctx, rm.bw, len(rest)); err != nil {
				return
			}
			dev.touch()
			dev.send(rest)
		case frameClose:
			dev.closeWith(deviceCloseCode(binary.BigEndian.Uint16(rest)), "closed by the daemon")
		}
	}
}

// authenticate sends the challenge and verifies the answer within the handshake deadline.
func (s *Server) authenticate(p *peer) (string, bool) {
	p.conn.SetReadLimit(helloSize)
	challenge := make([]byte, challengeSize)
	_, _ = rand.Read(challenge)
	if err := p.write(append([]byte{frameChallenge}, challenge...)); err != nil {
		return "", false
	}
	deadline := time.AfterFunc(s.cfg.HandshakeTimeout, func() {
		s.log.Warn("daemon handshake timeout")
		p.close(CodeHandshakeTimeout, "handshake timeout")
	})
	typ, msg, err := p.conn.Read(p.ctx)
	if !deadline.Stop() || err != nil {
		return "", false
	}
	id, ok := verifyHello(msg, challenge)
	if typ != websocket.MessageBinary || !ok {
		s.log.Warn("daemon authentication failed")
		p.close(CodeAuthFailed, "authentication failed")
		return "", false
	}
	return id, true
}

func (s *Server) openRoom(id string, limits Limits, daemon *peer) *room {
	rm := &room{
		id:      id,
		limits:  limits,
		daemon:  daemon,
		bw:      s.bw.acquire(id, limits),
		devices: map[uint32]*device{},
	}
	s.mu.Lock()
	old := s.rooms[id]
	s.rooms[id] = rm
	s.mu.Unlock()
	if old != nil {
		s.log.Info("room replaced", "room", short(id))
		old.daemon.close(CodeReplaced, "replaced by a new connection")
	} else {
		s.log.Info("room opened", "room", short(id))
	}
	return rm
}

func (s *Server) closeRoom(rm *room) {
	s.mu.Lock()
	replaced := s.rooms[rm.id] != rm
	if !replaced {
		delete(s.rooms, rm.id)
	}
	s.mu.Unlock()
	for _, dev := range rm.shut() {
		dev.closeWith(CodeDaemonOffline, "daemon offline")
	}
	s.bw.release(rm.bw)
	if !replaced {
		s.log.Info("room closed", "room", short(rm.id))
	}
}

func (s *Server) room(id string) *room {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rooms[id]
}

func (s *Server) handleDevice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validDaemonID(id) {
		http.Error(w, "bad daemon id", http.StatusBadRequest)
		return
	}
	ip := s.clientIP(r)
	if !s.admit(w, ip) {
		return
	}
	defer s.ips.release(ip)
	s.wg.Add(1)
	defer s.wg.Done()
	p := s.accept(w, r)
	if p == nil {
		return
	}
	defer s.untrack(p)

	rm := s.room(id)
	if rm == nil {
		p.close(CodeDaemonOffline, "daemon offline")
		p.drain()
		return
	}
	dev, code := rm.join(p)
	if dev == nil {
		if code == CodeRoomFull {
			s.log.Warn("room full", "room", short(id))
		}
		p.close(code, "room unavailable")
		p.drain()
		return
	}
	p.conn.SetReadLimit(rm.limits.MaxFrameBytes)
	go s.keepAlive(p)
	go dev.writeLoop()
	defer dev.idle.Stop()
	defer s.leave(rm, dev)
	if err := rm.daemon.write(encodeFrame(frameOpen, dev.channel, nil)); err != nil {
		dev.closeWith(CodeDaemonOffline, "daemon offline")
	}

	for {
		typ, msg, err := p.conn.Read(p.ctx)
		if err != nil {
			dev.recordEnd(err)
			return
		}
		if p.closing.Load() {
			continue
		}
		if typ != websocket.MessageBinary {
			dev.closeWith(CodeBadFrame, "binary frames only")
			continue
		}
		dev.touch()
		if err := s.bw.wait(p.ctx, rm.bw, len(msg)); err != nil {
			return
		}
		if err := rm.daemon.write(encodeFrame(frameData, dev.channel, msg)); err != nil {
			dev.closeWith(CodeDaemonOffline, "daemon offline")
		}
	}
}

// leave removes the device and tells the daemon, unless the room is gone with it.
func (s *Server) leave(rm *room, dev *device) {
	if rm.remove(dev) {
		_ = rm.daemon.write(encodeClose(dev.channel, dev.endCode()))
	}
}

func short(id string) string { return id[:8] }

func mustHex(id string) []byte {
	b := make([]byte, daemonIDSize)
	for i := range b {
		b[i] = unhex(id[2*i])<<4 | unhex(id[2*i+1])
	}
	return b
}

func unhex(c byte) byte {
	if c >= 'a' {
		return c - 'a' + 10
	}
	return c - '0'
}

// peer is one WebSocket connection.
type peer struct {
	conn    *websocket.Conn
	ctx     context.Context
	cancel  context.CancelFunc
	closing atomic.Bool
}

// close starts the close handshake in the background; the reader then gets an error.
func (p *peer) close(code int, reason string) {
	if p.closing.CompareAndSwap(false, true) {
		go func() { _ = p.conn.Close(websocket.StatusCode(code), reason) }()
	}
}

// drain reads until the connection ends so a started close handshake can finish.
func (p *peer) drain() {
	for {
		if _, _, err := p.conn.Read(p.ctx); err != nil {
			return
		}
	}
}

func (p *peer) write(msg []byte) error {
	ctx, cancel := context.WithTimeout(p.ctx, writeTimeout)
	defer cancel()
	return p.conn.Write(ctx, websocket.MessageBinary, msg)
}

// room is one daemon and its devices.
type room struct {
	id     string
	limits Limits
	daemon *peer
	bw     *bandwidthEntry

	mu      sync.Mutex
	devices map[uint32]*device
	next    uint32
	shutAll bool
}

// join adds a device, or returns the close code that refuses it.
func (rm *room) join(p *peer) (*device, int) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	if rm.shutAll {
		return nil, CodeDaemonOffline
	}
	if len(rm.devices) >= rm.limits.MaxDevices {
		return nil, CodeRoomFull
	}
	rm.next++
	dev := &device{
		peer:     p,
		channel:  rm.next,
		queue:    make(chan []byte, 256),
		queueMax: rm.limits.DeviceQueueBytes,
		idleFor:  rm.limits.IdleTimeout,
	}
	dev.idle = time.AfterFunc(dev.idleFor, func() { dev.closeWith(CodeIdle, "idle") })
	rm.devices[dev.channel] = dev
	return dev, 0
}

func (rm *room) device(channel uint32) *device {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	return rm.devices[channel]
}

// remove reports whether the device was still in an open room.
func (rm *room) remove(dev *device) bool {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	if _, ok := rm.devices[dev.channel]; !ok {
		return false
	}
	delete(rm.devices, dev.channel)
	return !rm.shutAll
}

// shut empties the room and returns its devices; nobody can join afterwards.
func (rm *room) shut() []*device {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.shutAll = true
	devs := make([]*device, 0, len(rm.devices))
	for _, d := range rm.devices {
		devs = append(devs, d)
	}
	rm.devices = map[uint32]*device{}
	return devs
}

// device is a device connection in a room, with its outbound queue.
type device struct {
	*peer
	channel  uint32
	queue    chan []byte
	queued   atomic.Int64
	queueMax int64
	idle     *time.Timer
	idleFor  time.Duration
	code     atomic.Int32
}

func (d *device) touch() { d.idle.Reset(d.idleFor) }

// send queues a message for the device, dropping the device when it cannot keep up.
func (d *device) send(msg []byte) {
	if d.closing.Load() {
		return
	}
	if d.queued.Add(int64(len(msg))) > d.queueMax {
		d.closeWith(CodeSlowDevice, "too slow")
		return
	}
	select {
	case d.queue <- msg:
	default:
		d.closeWith(CodeSlowDevice, "too slow")
	}
}

func (d *device) writeLoop() {
	for {
		select {
		case <-d.ctx.Done():
			return
		case msg := <-d.queue:
			if err := d.write(msg); err != nil {
				return
			}
			d.queued.Add(-int64(len(msg)))
		}
	}
}

// closeWith closes the device and remembers why, for the daemon's CLOSE frame.
func (d *device) closeWith(code int, reason string) {
	d.code.CompareAndSwap(0, int32(code))
	d.close(code, reason)
}

// recordEnd keeps the reason the device's connection ended, when the relay did not choose one.
func (d *device) recordEnd(err error) {
	switch {
	case errors.Is(err, websocket.ErrMessageTooBig):
		d.code.CompareAndSwap(0, CodeTooBig)
	case websocket.CloseStatus(err) != -1:
		d.code.CompareAndSwap(0, int32(websocket.CloseStatus(err)))
	default:
		d.code.CompareAndSwap(0, int32(websocket.StatusGoingAway))
	}
}

func (d *device) endCode() uint16 {
	if c := d.code.Load(); c > 0 {
		return uint16(c)
	}
	return uint16(websocket.StatusGoingAway)
}
