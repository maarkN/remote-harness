package relay

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"time"

	longplay "longplayai.com/sdk/go"
)

// LongplayLimitsFromEnv is an optional paid-device pilot. The operator binds already
// authenticated daemon IDs to Customers; an unbound computer always keeps free limits.
// It does not enroll accounts, receive store receipts or change the encrypted protocol.
func LongplayLimitsFromEnv(getenv func(string) string, free Limits) (func(string) Limits, func(), error) {
	if getenv("RELAY_LONGPLAY_FEATURE_ID") == "" {
		return nil, func() {}, nil
	}
	feature := getenv("RELAY_LONGPLAY_FEATURE_ID")
	paidDevices, err := strconv.Atoi(getenv("RELAY_LONGPLAY_MAX_DEVICES"))
	if err != nil || paidDevices <= free.MaxDevices || !regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`).MatchString(feature) {
		return nil, nil, fmt.Errorf("Longplay needs an access Feature UUID and a device limit above the free limit")
	}
	// Explicit origin: no accidental production fallback for a misconfigured test deployment.
	if getenv("RELAY_LONGPLAY_BASE_URL") == "" {
		return nil, nil, fmt.Errorf("RELAY_LONGPLAY_BASE_URL is required")
	}
	data, err := os.ReadFile(getenv("RELAY_LONGPLAY_BINDINGS_FILE"))
	if err != nil || len(data) > 1<<20 {
		return nil, nil, fmt.Errorf("could not read bounded Longplay computer bindings")
	}
	bindings := map[string]string{}
	if json.Unmarshal(data, &bindings) != nil || len(bindings) > 10000 {
		return nil, nil, fmt.Errorf("invalid Longplay computer bindings")
	}
	for daemon, customer := range bindings {
		if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(daemon) || customer == "" {
			return nil, nil, fmt.Errorf("bindings require daemon public-key hashes and Customer IDs")
		}
	}
	client, err := longplay.NewClient(longplay.Config{
		APIKey: getenv("RELAY_LONGPLAY_SECRET_KEY"), ProjectID: getenv("RELAY_LONGPLAY_APP_ID"),
		Environment: longplay.Environment(getenv("RELAY_LONGPLAY_ENVIRONMENT")),
		BaseURL:     getenv("RELAY_LONGPLAY_BASE_URL"), Timeout: 3 * time.Second,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("invalid Longplay server configuration")
	}
	resolve := paidDeviceLimits(free, paidDevices, bindings, func(customer string) bool {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		result, err := client.CheckEntitlement(ctx, longplay.CheckEntitlementParams{
			CustomerID:  customer,
			Requirement: longplay.CheckEntitlementParamsRequirement{InternalFeatureID: feature, Quantity: "1", Properties: map[string]any{}},
		})
		return err == nil && result.Check.Kind == "access" && result.Check.Allowed
	})
	return resolve, client.Close, nil
}

func paidDeviceLimits(free Limits, count int, bindings map[string]string, allowed func(string) bool) func(string) Limits {
	return func(daemon string) Limits {
		result := free
		if customer := bindings[daemon]; customer != "" && allowed(customer) {
			result.MaxDevices = count
		}
		return result
	}
}
