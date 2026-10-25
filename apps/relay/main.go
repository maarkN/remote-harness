// Command relay runs the Remote Harness connection relay. Configuration comes from RELAY_*
// environment variables (see internal/relay/config.go and the daemon docs page).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/maarkN/remote-harness/apps/relay/internal/relay"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := relay.ConfigFromEnv(os.Getenv)
	if err != nil {
		log.Error("bad configuration", "error", err)
		os.Exit(2)
	}
	srv := relay.New(cfg, log)
	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	served := make(chan error, 1)
	go func() { served <- httpSrv.ListenAndServe() }()
	log.Info("relay listening", "addr", cfg.Addr, "maxDevices", cfg.Limits.MaxDevices,
		"maxFrameBytes", cfg.Limits.MaxFrameBytes, "roomRateBytes", cfg.Limits.RateBytes)

	select {
	case err := <-served:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Error("relay stopped", "error", err)
			os.Exit(1)
		}
	case <-stop:
		ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		// Relay first: /healthz turns 503 and new upgrades are refused while the rooms close.
		if err := srv.Shutdown(ctx); err != nil {
			log.Warn("connections still open at exit", "error", err)
		}
		_ = httpSrv.Shutdown(ctx)
		log.Info("relay stopped")
	}
}
