// Command healthcheck is the image's HEALTHCHECK: the distroless base has no shell or wget.
package main

import (
	"net"
	"net/http"
	"os"
	"time"
)

func main() {
	_, port, err := net.SplitHostPort(os.Getenv("RELAY_ADDR"))
	if err != nil || port == "" {
		port = "8080"
	}
	client := http.Client{Timeout: 2 * time.Second}
	res, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil || res.StatusCode != http.StatusOK {
		os.Exit(1)
	}
}
