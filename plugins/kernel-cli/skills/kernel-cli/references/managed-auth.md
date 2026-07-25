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
| `--telemetry=<value>` | Default telemetry (`all`, `off`, or category list) for this connection's browser sessions |
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

Telemetry is opt-in. On create, `--telemetry=all` enables the default set, `--telemetry=off` disables capture, and `--telemetry=console,network` captures exactly those categories.

## update

Update settings used by future login sessions:

```bash
kernel auth connections update <id> --telemetry=console,network -o json
kernel auth connections update <id> --telemetry=off -o json
```

Named categories merge into the current selection. `all` and `off` reset the complete telemetry config. Other update flags include login URL, health-check interval, credential source, proxy, allowed domains, and credential-saving behavior; run `kernel auth connections update --help` before changing them.

## get

```bash
kernel auth connections get <id> [-o json]
```

Shows: ID, domain, profile, status, flow status/step, credential, health check interval, hosted URL, live view URL, error message, last auth time, allowed domains, fields, and choices.

## list

```bash
kernel auth connections list [--domain <domain>] [--profile-name <name>] [--limit N] [--offset N] [-o json]
```

## delete

```bash
kernel auth connections delete <id> [-y]
```

## login

Start a login flow. Returns hosted URL, flow type, and expiry. A login telemetry override merges onto the connection default for this flow only.

```bash
kernel auth connections login <id> --telemetry=network,page -o json
```

Use `--proxy-id` or `--proxy-name` to override the proxy for this login.

## submit

Submit field values or select a choice from the active flow. Prefer canonical IDs returned in the connection's `fields` and `choices` lists; names accepted by legacy `--field` can be ambiguous.

```bash
# Canonical field IDs; repeat for each requested field
kernel auth connections submit <id> \
  --field-value 'field_username=myuser' \
  --field-value 'field_password=<value>'

# Canonical choice ID for SSO, MFA, or another discovered choice
kernel auth connections submit <id> --choice-id <choice-id>
```

Legacy selectors remain available (`--field`, `--mfa-option-id`, `--sign-in-option-id`, `--sso-button-selector`, and `--sso-provider`). Do not put real credential values in logs or committed shell scripts.

## timeline

Inspect login, reauth, and health-check history, newest first:

```bash
kernel auth connections timeline <id> --page 1 --per-page 20 -o json
kernel auth connections timeline <id> --type reauth -o json
```

`--type` accepts `login`, `reauth`, or `health_check`; pages are 1-based.

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
