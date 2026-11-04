package relay

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPaidLimitsDisabled(t *testing.T) {
	resolve, close, err := LongplayLimitsFromEnv(func(string) string { return "" }, DefaultConfig().Limits)
	if err != nil || resolve != nil || close == nil {
		t.Fatal("free deployment must need no billing setup")
	}
	close()
}

func TestPaidLimitsUseOnlyBoundComputersAndFreshAccess(t *testing.T) {
	free := DefaultConfig().Limits
	granted, calls := true, 0
	resolve := paidDeviceLimits(free, 20, map[string]string{"computer": "owner-customer"}, func(customer string) bool {
		if customer != "owner-customer" {
			t.Fatal("wrong billing identity")
		}
		calls++
		return granted
	})
	if resolve("unknown") != free || calls != 0 {
		t.Fatal("unbound computers must not contact billing")
	}
	want := free
	want.MaxDevices = 20
	if resolve("computer") != want {
		t.Fatal("only the configured device limit should increase")
	}
	granted = false
	if resolve("computer") != free || calls != 2 {
		t.Fatal("a later connection must observe revocation")
	}
}

func TestPaidLimitsValidateOperatorConfiguration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bindings.json")
	if err := os.WriteFile(path, []byte(`{"`+strings.Repeat("a", 64)+`":"customer"}`), 0600); err != nil {
		t.Fatal(err)
	}
	env := map[string]string{
		"RELAY_LONGPLAY_FEATURE_ID":  "11111111-1111-4111-8111-111111111111",
		"RELAY_LONGPLAY_MAX_DEVICES": "20", "RELAY_LONGPLAY_BASE_URL": "https://billing.example",
		"RELAY_LONGPLAY_BINDINGS_FILE": path, "RELAY_LONGPLAY_SECRET_KEY": "gg_sk_test_credential",
		"RELAY_LONGPLAY_APP_ID": "app", "RELAY_LONGPLAY_ENVIRONMENT": "sandbox",
	}
	resolve, close, err := LongplayLimitsFromEnv(func(k string) string { return env[k] }, DefaultConfig().Limits)
	if err != nil {
		t.Fatal(err)
	}
	close()
	if resolve == nil {
		t.Fatal("configured pilot should be wired")
	}
	for key, bad := range map[string]string{"RELAY_LONGPLAY_MAX_DEVICES": "1", "RELAY_LONGPLAY_BASE_URL": "", "RELAY_LONGPLAY_ENVIRONMENT": "wrong", "RELAY_LONGPLAY_SECRET_KEY": "customer-token", "RELAY_LONGPLAY_FEATURE_ID": "not-a-uuid"} {
		t.Run(key, func(t *testing.T) {
			old := env[key]
			env[key] = bad
			defer func() { env[key] = old }()
			_, _, err := LongplayLimitsFromEnv(func(k string) string { return env[k] }, DefaultConfig().Limits)
			if err == nil {
				t.Fatal("bad billing config must be rejected")
			}
		})
	}
}
