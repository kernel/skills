# Managed Auth CLI Commands

All commands live under `kernel auth connections`.

## create

Create a managed auth connection for a profile + domain.

```bash
kernel auth connections create --domain <domain> --profile-name <name> [flags]
```

| Flag | Description |
|------|-------------|
| `--domain` | Target domain (required) |
| `--profile-name` | Profile to manage (required) |
| `--credential-name` | Kernel credential name |
| `--credential-provider` | External provider name (e.g., 1Password) |
| `--credential-path` | Provider-specific path (e.g., `VaultName/ItemName`) |
| `--credential-auto` | Auto-lookup credential by domain from provider |
| `--proxy-id` | Proxy ID |
| `--proxy-name` | Proxy name |
| `--login-url` | Custom login page URL |
| `--allowed-domain` | Additional allowed domains (repeatable) |
| `--health-check-interval` | Seconds between health checks (300-86400) |
| `--no-save-credentials` | Don't save credentials after login |
| `-o json` | JSON output |

### Credential source examples

```bash
# Kernel credential
kernel auth connections create --domain github.com --profile-name gh \
  --credential-name my-github-cred

# 1Password explicit path
kernel auth connections create --domain github.com --profile-name gh \
  --credential-provider my-1p --credential-path "DevVault/GitHub"

# 1Password auto-lookup by domain
kernel auth connections create --domain github.com --profile-name gh \
  --credential-provider my-1p --credential-auto
```

## get

```bash
kernel auth connections get <id> [-o json]
```

Shows: ID, domain, profile, status, flow status/step, credential, health check interval, hosted URL, live view URL, error message, last auth time, allowed domains.

## list

```bash
kernel auth connections list [--domain <domain>] [--profile-name <name>] [--limit N] [--offset N] [-o json]
```

## delete

```bash
kernel auth connections delete <id> [-y]
```

## login

Start a login flow. Returns hosted URL, flow type, and expiry.

```bash
kernel auth connections login <id> [--proxy-id <id>] [--proxy-name <name>] [-o json]
```

## submit

Submit field values, SSO button selection, or MFA option to an active login flow.

```bash
# Submit credentials
kernel auth connections submit <id> --field username=myuser --field password=mypass

# Select SSO button
kernel auth connections submit <id> --sso-button-selector "//button[@id='google-sso']"

# Select MFA method
kernel auth connections submit <id> --mfa-option-id totp
```

## follow

Stream login flow events via SSE in real time.

```bash
kernel auth connections follow <id> [-o json]
```

Human-readable output shows timestamped status/step updates, discovered fields, errors, and website errors. JSON output emits raw SSE events.

## credential-providers

Manage external credential providers (e.g., 1Password).

```bash
kernel credential-providers list [-o json]
kernel credential-providers get <id> [-o json]
kernel credential-providers create --name <name> --provider-type onepassword --token <token>
kernel credential-providers test <id> [-o json]
kernel credential-providers list-items <id> [-o json]
kernel credential-providers delete <id> [-y]
```

## Connection Statuses

| Status | Meaning |
|--------|---------|
| `AUTHENTICATED` | Profile is logged in |
| `NEEDS_AUTH` | Profile needs authentication |

## Flow Statuses

| Status | Meaning |
|--------|---------|
| `IN_PROGRESS` | Login ongoing |
| `SUCCESS` | Login completed |
| `FAILED` | Login failed (check error_message) |
| `EXPIRED` | Flow timed out (5 min) |
| `CANCELED` | Flow was canceled |

## Flow Steps

| Step | Meaning |
|------|---------|
| `DISCOVERING` | Finding and analyzing login page |
| `AWAITING_INPUT` | Waiting for field values, SSO, or MFA selection |
| `SUBMITTING` | Processing submitted values |
| `AWAITING_EXTERNAL_ACTION` | Waiting for push/security key |
| `COMPLETED` | Flow finished |
