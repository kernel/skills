# managed auth cli commands

all commands live under `kernel auth connections`.

## create

create a managed auth connection for a profile + domain.

```bash
kernel auth connections create --domain <domain> --profile-name <name> [flags]
```

| flag | description |
|------|-------------|
| `--domain` | Target domain (required) |
| `--profile-name` | profile to manage (required) |
| `--credential-name` | KERNEL credential name |
| `--credential-provider` | external provider name (e.g., 1Password) |
| `--credential-path` | provider-specific path (e.g., `VaultName/ItemName`) |
| `--credential-auto` | auto-lookup credential by domain from provider |
| `--proxy-id` | proxy id |
| `--proxy-name` | proxy name |
| `--login-url` | custom login page url |
| `--allowed-domain` | additional allowed domains (repeatable) |
| `--health-check-interval` | seconds between health checks (300-86400) |
| `--no-save-credentials` | don't save credentials after login |
| `--telemetry=<value>` | default telemetry (`all`, `off`, or category list) for this connection's browser sessions |
| `-o json` | json output |

### credential source examples

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

telemetry is opt-in. on create, `--telemetry=all` enables the default set, `--telemetry=off` disables capture, and `--telemetry=console,network` captures exactly those categories.

## update

update settings used by future login sessions:

```bash
kernel auth connections update <id> --telemetry=console,network -o json
kernel auth connections update <id> --telemetry=off -o json
```

named categories merge into the current selection. `all` and `off` reset the complete telemetry config. other update flags include login url, health-check interval, credential source, proxy, allowed domains, and credential-saving behavior; run `kernel auth connections update --help` before changing them.

## get

```bash
kernel auth connections get <id> [-o json]
```

shows: id, domain, profile, status, flow status/step, credential, health check interval, hosted url, live view url, error message, last auth time, allowed domains, fields, and choices.

## list

```bash
kernel auth connections list [--domain <domain>] [--profile-name <name>] [--limit N] [--offset N] [-o json]
```

## delete

```bash
kernel auth connections delete <id> [-y]
```

## login

start a login flow. returns hosted url, flow type, and expiry. a login telemetry override merges onto the connection default for this flow only.

```bash
kernel auth connections login <id> --telemetry=network,page -o json
```

use `--proxy-id` or `--proxy-name` to override the proxy for this login.

## submit

submit field values or select a choice from the active flow. prefer canonical ids returned in the connection's `fields` and `choices` lists; names accepted by legacy `--field` can be ambiguous.

```bash
# Canonical field IDs; repeat for each requested field
kernel auth connections submit <id> \
  --field-value 'field_username=myuser' \
  --field-value 'field_password=<value>'

# Canonical choice ID for SSO, MFA, or another discovered choice
kernel auth connections submit <id> --choice-id <choice-id>
```

legacy selectors remain available (`--field`, `--mfa-option-id`, `--sign-in-option-id`, `--sso-button-selector`, and `--sso-provider`). do not put real credential values in logs or committed shell scripts.

## timeline

inspect login, reauth, and health-check history, newest first:

```bash
kernel auth connections timeline <id> --page 1 --per-page 20 -o json
kernel auth connections timeline <id> --type reauth -o json
```

`--type` accepts `login`, `reauth`, or `health_check`; pages are 1-based.

## follow

stream login flow events via sse in real time.

```bash
kernel auth connections follow <id> [-o json]
```

human-readable output shows timestamped status/step updates, discovered fields, errors, and website errors. json output emits raw sse events.

## credential-providers

manage external credential providers (e.g., 1Password).

```bash
kernel credential-providers list [-o json]
kernel credential-providers get <id> [-o json]
kernel credential-providers create --name <name> --provider-type onepassword --token <token>
kernel credential-providers test <id> [-o json]
kernel credential-providers list-items <id> [-o json]
kernel credential-providers delete <id> [-y]
```

## connection statuses

| status | meaning |
|--------|---------|
| `AUTHENTICATED` | profile is logged in |
| `NEEDS_AUTH` | profile needs authentication |

## flow statuses

| status | meaning |
|--------|---------|
| `IN_PROGRESS` | login ongoing |
| `SUCCESS` | login completed |
| `FAILED` | login failed (check error_message) |
| `EXPIRED` | flow timed out (5 min) |
| `CANCELED` | flow was canceled |

## flow steps

| step | meaning |
|------|---------|
| `DISCOVERING` | finding and analyzing login page |
| `AWAITING_INPUT` | waiting for field values, sso, or mfa selection |
| `SUBMITTING` | processing submitted values |
| `AWAITING_EXTERNAL_ACTION` | waiting for push/security key |
| `COMPLETED` | flow finished |
