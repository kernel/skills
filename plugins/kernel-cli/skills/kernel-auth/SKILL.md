---
name: kernel-auth
description: Create, update, inspect, and troubleshoot Kernel managed auth connections, login and submit flows, profiles, telemetry, health checks, and automatic reauthentication for any website.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["kernel"] },
      },
  }
---

# Kernel Managed Auth

Use `kernel auth connections` to keep a named browser profile authenticated to a website. Use the same connection for initial login, later human-assisted login, and automatic reauthentication.

## Safe defaults

1. Scope every resource to the intended project. Set `KERNEL_PROJECT` once or pass global `--project <id-or-name>` to every command.
2. Reuse an existing connection for the same domain and profile instead of creating duplicates.
3. Prefer credential references over putting secrets in command arguments, logs, chat, or shell history.
4. Keep profile downloads outside repositories; they can contain cookies and authenticated browser state.
5. Delete temporary browsers, connections, profiles, and downloaded state after testing.

Check for an existing connection:

```bash
kernel auth connections list \
  --domain example.com \
  --profile-name example-main \
  -o json
```

## Create a connection

A connection requires a domain and profile name. Kernel creates the profile automatically if it does not exist.

```bash
CONNECTION_ID=$(
  kernel auth connections create \
    --domain example.com \
    --profile-name example-main \
    -o json | jq -r '.id'
)
```

Add only settings required by the site:

```bash
kernel auth connections create \
  --domain example.com \
  --profile-name example-main \
  --login-url https://example.com/login \
  --allowed-domain auth.example.com \
  --credential-name example-credential \
  --proxy-id prx_123 \
  --health-check-interval 3600 \
  --telemetry=console,network \
  -o json
```

Important creation behavior:

- Repeat `--allowed-domain` for non-standard redirect domains. Common SSO provider domains are allowed automatically.
- Use either `--credential-name` or `--credential-provider`, not both.
- With `--credential-provider <provider>`, omit `--credential-path` to enable provider lookup by domain automatically. Use `--credential-path <path>` to select a specific external item.
- Prefer `--proxy-id` over `--proxy-name` for a stable, unambiguous reference.
- Credentials are saved after successful login by default; `--no-save-credentials` disables this and usually prevents unattended reauthentication.
- Health checks and automatic reauthentication default on server-side. The health-check interval defaults to one hour; accepted minimums depend on the organization's plan.

A connection's domain and profile cannot be changed with `update`; create another connection when either must differ.

## Update a connection

Updates are partial except where noted:

```bash
kernel auth connections update "$CONNECTION_ID" \
  --login-url https://example.com/sign-in \
  --health-check-interval 3600 \
  --save-credentials \
  -o json
```

Non-obvious update behavior:

- `--allowed-domain` replaces the entire allowed-domain list; repeat it with every domain to retain.
- Pass `--login-url ''` to clear a custom login URL.
- When changing to an external provider's domain lookup, pass both `--credential-provider <provider>` and `--credential-auto`. Unlike create, update does not infer auto lookup.
- Use either `--save-credentials` or `--no-save-credentials`.
- A telemetry category list merges those categories into the connection's existing config for future managed-auth sessions.

Inspect the result after every update:

```bash
kernel auth connections get "$CONNECTION_ID" -o json | jq '{
  id,
  domain,
  profile_name,
  status,
  flow_status,
  flow_step,
  can_reauth,
  can_reauth_reason,
  health_checks,
  health_check_interval,
  browser_telemetry
}'
```

## Start and complete a login

Start a login or reauthentication flow with the existing connection:

```bash
kernel auth connections login "$CONNECTION_ID" -o json
```

The response tells you whether Kernel started a `LOGIN` or `REAUTH` flow and includes `hosted_url`, `live_view_url`, and `flow_expires_at`. Treat these URLs as sensitive and open the hosted URL directly rather than sending it through link-previewing chat or email clients.

Track the flow in another terminal:

```bash
kernel auth connections follow "$CONNECTION_ID"
```

Or poll the current state and canonical prompts:

```bash
kernel auth connections get "$CONNECTION_ID" -o json | jq '{
  status,
  flow_status,
  flow_step,
  flow_expires_at,
  fields,
  choices,
  external_action_message,
  website_error,
  error_code,
  error_message
}'
```

When `flow_step` is `AWAITING_INPUT`, prefer the canonical IDs returned in `fields` and `choices`:

```bash
# Submit one or more fields as one submit mode.
kernel auth connections submit "$CONNECTION_ID" \
  --field-value 'field_email=<value>' \
  --field-value 'field_password=<value>'

# Or select exactly one returned choice.
kernel auth connections submit "$CONNECTION_ID" \
  --choice-id 'choice_sms'
```

Use exactly one submit mode per call. Do not combine canonical fields, a canonical choice, or any legacy selector in the same call. `--field` is legacy; use `--field-value` when `fields` is present. Legacy-only flows may still require one of:

```bash
kernel auth connections submit "$CONNECTION_ID" --mfa-option-id sms
kernel auth connections submit "$CONNECTION_ID" --sign-in-option-id '<id>'
kernel auth connections submit "$CONNECTION_ID" --sso-provider google
kernel auth connections submit "$CONNECTION_ID" --sso-button-selector '<xpath>'
```

A successful `submit` means the input was accepted for processing, not that authentication has completed. Wait for `flow_status=SUCCESS` and `status=AUTHENTICATED`.

If a stale flow is past `flow_expires_at`, call `login` again to supersede it. Do not delete the connection or profile just to refresh an expired flow.

## Telemetry

Configure telemetry when creating a connection, updating defaults for future managed-auth sessions, or overriding one login:

```bash
# Reset to the default telemetry categories.
kernel auth connections update "$CONNECTION_ID" --telemetry=all

# Disable telemetry.
kernel auth connections update "$CONNECTION_ID" --telemetry=off

# Enable selected categories on future managed-auth sessions.
kernel auth connections update "$CONNECTION_ID" --telemetry=console,network,page

# Override only this login; the override merges onto the connection config.
kernel auth connections login "$CONNECTION_ID" --telemetry=screenshot,network
```

Settable categories are `console`, `network`, `page`, `interaction`, `control`, `connection`, `system`, `screenshot`, and `captcha`. `all` means the default category set, not every category. A category list on create selects that list; on update it merges into the current selection. To remove selected categories, reset with `off`, then enable the desired set in a second update.

This setting applies to managed-auth browser sessions. Configure telemetry separately on ordinary sessions created later with `kernel browsers create`.

## Diagnose reauthentication

Do not infer reauthentication readiness from `status` alone:

```bash
kernel auth connections get "$CONNECTION_ID" -o json | jq '{
  status,
  can_reauth,
  can_reauth_reason,
  auto_reauth,
  health_checks,
  health_check_interval,
  credential,
  save_credentials
}'
```

Automatic reauthentication requires scheduled health checks, automatic reauth enabled, and a feasible credential or recorded login plan. `can_reauth=false` means a human action is currently required; inspect `can_reauth_reason` rather than repeatedly restarting the flow. Common blockers include no prior successful login, no credential, no viable plan, external action, or an unavailable TOTP/SMS/email code.

For a connection in `NEEDS_AUTH`:

1. Attach or correct its credential reference with `update` when one is available.
2. Call `login` on the existing connection.
3. Complete any canonical fields, choices, or external action.
4. Confirm `status=AUTHENTICATED` and `can_reauth=true`.
5. Check the timeline for subsequent health-check or reauth outcomes.

## Inspect the timeline

Timeline events are ordered most recent first:

```bash
kernel auth connections timeline "$CONNECTION_ID"
kernel auth connections timeline "$CONNECTION_ID" --type reauth
kernel auth connections timeline "$CONNECTION_ID" --type health_check --page 1 --per-page 50
```

JSON output is an object containing `events`, `page`, `per_page`, and `has_more`:

```bash
kernel auth connections timeline "$CONNECTION_ID" -o json |
  jq '.events[] | {timestamp, type, status, step, browser_session_id, error_code, error_message, website_error}'
```

Use `login` events for human/initial attempts, `reauth` for automatic or subsequent authentication attempts, and `health_check` to see when session validity changed between `AUTHENTICATED` and `NEEDS_AUTH`.

## Use and protect the profile

Create an ordinary browser from the authenticated profile:

```bash
kernel browsers create --profile-name example-main --stealth -o json
```

Delete that browser when finished:

```bash
kernel browsers delete <browser-id-or-name>
```

Rename or download profile state with the current profile commands:

```bash
kernel profiles update example-main --name example-primary -o json

PROFILE_DIR=$(mktemp -d)
kernel profiles download example-primary --to "$PROFILE_DIR" --format tar.zst
# Inspect locally; never commit the extracted state.
rm -rf "${PROFILE_DIR:?}"
```

`--format` accepts `tar.zst` (default) or `tar`; both are extracted into `--to`. If the profile has no saved data yet, download reports that it must first be used in a browser session.

## Cleanup temporary setup

Deleting a connection terminates its workflow and cancels any in-progress login. It is separate from deleting the profile:

```bash
kernel auth connections delete "$CONNECTION_ID"   # confirm interactively
kernel profiles delete example-main                # only if its saved state is disposable
```

Use `--yes` only in automation after verifying the exact connection ID or profile name. Never delete a reused authenticated profile as routine reauthentication recovery.
