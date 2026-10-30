package relay

import (
	"context"
	"sync"
	"time"
)

// bucket is a token bucket that may go into debt: take never refuses, it returns how long the
// caller must wait so the average stays at rate. Callers sleep instead of dropping frames.
type bucket struct {
	rate   float64 // tokens per second
	burst  float64
	tokens float64
	last   time.Time
}

func newBucket(rate, burst float64, now time.Time) *bucket {
	return &bucket{rate: rate, burst: burst, tokens: burst, last: now}
}

func (b *bucket) refill(now time.Time) {
	if elapsed := now.Sub(b.last).Seconds(); elapsed > 0 {
		b.tokens = min(b.burst, b.tokens+elapsed*b.rate)
	}
	b.last = now
}

// take spends n tokens and returns the wait before the spend is covered.
func (b *bucket) take(n float64, now time.Time) time.Duration {
	b.refill(now)
	b.tokens -= n
	if b.tokens >= 0 {
		return 0
	}
	return time.Duration(-b.tokens / b.rate * float64(time.Second))
}

// tryTake spends one token only when there is one.
func (b *bucket) tryTake(now time.Time) bool {
	b.refill(now)
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func (b *bucket) full(now time.Time) bool {
	b.refill(now)
	return b.tokens >= b.burst
}

// bandwidth holds one bucket per daemon ID, kept across that daemon's reconnections.
type bandwidth struct {
	mu      sync.Mutex
	now     func() time.Time
	buckets map[string]*bandwidthEntry
}

type bandwidthEntry struct {
	bucket *bucket
	users  int
}

func newBandwidth(now func() time.Time) *bandwidth {
	return &bandwidth{now: now, buckets: map[string]*bandwidthEntry{}}
}

// acquire returns the room's bucket; release must follow when the room closes.
func (bw *bandwidth) acquire(id string, l Limits) *bandwidthEntry {
	bw.mu.Lock()
	defer bw.mu.Unlock()
	e, ok := bw.buckets[id]
	if !ok {
		e = &bandwidthEntry{bucket: newBucket(float64(l.RateBytes), float64(l.BurstBytes), bw.now())}
		bw.buckets[id] = e
	}
	e.users++
	return e
}

func (bw *bandwidth) release(e *bandwidthEntry) {
	bw.mu.Lock()
	defer bw.mu.Unlock()
	e.users--
}

// wait spends n bytes from the entry's bucket, sleeping while it is in debt.
func (bw *bandwidth) wait(ctx context.Context, e *bandwidthEntry, n int) error {
	bw.mu.Lock()
	d := e.bucket.take(float64(n), bw.now())
	bw.mu.Unlock()
	if d <= 0 {
		return nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// sweep drops the buckets of rooms that are closed and fully refilled.
func (bw *bandwidth) sweep() {
	bw.mu.Lock()
	defer bw.mu.Unlock()
	now := bw.now()
	for id, e := range bw.buckets {
		if e.users == 0 && e.bucket.full(now) {
			delete(bw.buckets, id)
		}
	}
}

func (bw *bandwidth) size() int {
	bw.mu.Lock()
	defer bw.mu.Unlock()
	return len(bw.buckets)
}

// ipLimiter bounds the connection rate and the open connections per client IP. IPs live only
// here, in memory, and an entry is dropped once it has no open connection and a full bucket.
type ipLimiter struct {
	mu       sync.Mutex
	now      func() time.Time
	rate     float64 // per second
	burst    float64
	maxConns int
	entries  map[string]*ipEntry
}

type ipEntry struct {
	bucket *bucket
	conns  int
}

func newIPLimiter(perMinute, burst float64, maxConns int, now func() time.Time) *ipLimiter {
	return &ipLimiter{now: now, rate: perMinute / 60, burst: burst, maxConns: maxConns, entries: map[string]*ipEntry{}}
}

// acquire counts a new connection from ip, or refuses it when over the rate or the open count.
func (l *ipLimiter) acquire(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	e, ok := l.entries[ip]
	if !ok {
		e = &ipEntry{bucket: newBucket(l.rate, l.burst, now)}
		l.entries[ip] = e
	}
	if e.conns >= l.maxConns || !e.bucket.tryTake(now) {
		return false
	}
	e.conns++
	return true
}

func (l *ipLimiter) release(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if e, ok := l.entries[ip]; ok {
		e.conns--
		if e.conns <= 0 && e.bucket.full(l.now()) {
			delete(l.entries, ip)
		}
	}
}

func (l *ipLimiter) sweep() {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	for ip, e := range l.entries {
		if e.conns <= 0 && e.bucket.full(now) {
			delete(l.entries, ip)
		}
	}
}

func (l *ipLimiter) size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}
