---
name: kernel-auth
description: Use Kernel managed auth after choosing a browser path that genuinely requires an authenticated website UI or authenticated browser behavior. Prefer a dedicated API, CLI, MCP server, or authoritative local records for operations they support; a URL alone does not require browser auth. Reuse or create auth connections, complete hosted login without abandoning the task, launch profile-backed browsers with telemetry, and handle reauthentication safely.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["kernel"] },
      },
  }
---

# Kernel Managed Auth

Use a managed auth connection to acquire a reusable authenticated browser profile, then continue the original website task with the browser-control method that fits it. This skill owns authentication and the handoff to a profile-backed browser; it does not assume the task is QA.

## Decide whether managed auth is needed

Make this decision before listing or creating managed-auth connections:

1. Treat a URL as a resource identifier, not as evidence that the task requires browser access.
2. For structured reads and writes, prefer authoritative local records or a dedicated, service-specific API, CLI, MCP server, or other first-party integration when it supports the operation. Search the host's tool catalog, including deferred MCP tools, before concluding that no integration is available.
3. Choose a browser only when the task genuinely requires the authenticated website UI, the dedicated integration lacks the needed capability, or browser behavior itself is under test.
4. After choosing a browser, start hosted login only when the target operation requires authenticated state. Public or unauthenticated pages should not trigger managed auth.

If a dedicated integration can complete the task, use it and do not continue with this skill. If the decision selects an authenticated browser path, follow the workflow below; authenticated browser tasks must still use managed auth.

## Browser handoff model

A managed-auth login runs in its own temporary browser. It does not take over or authenticate an existing task browser in place. If an ordinary browser encounters a login wall:

1. Pause all automation against that task browser. Its page and live view may continue to show the logged-out site while managed auth advances elsewhere.
2. Start one managed-auth flow and keep all authentication interactions attached to that flow until it completes.
3. Follow or wait on the active flow. Do not call `login` to poll: another `login` call supersedes the current flow.
4. After `flow_status=SUCCESS` and `status=AUTHENTICATED`, create a new ordinary browser from the connection's saved profile, attach the existing browser-control stack to that new session, and resume the task. Switch any live view to the new task browser.

The original task browser's transient page state does not move into the managed-auth browser or the replacement profile-backed browser. Preserve the target URL and any task state needed to resume, and delete the old task browser when it is no longer needed.

## Core workflow

1. Scope resources to the intended Kernel project and identify the canonical site, current hostname, target URL, account context, and any task state needed after authentication.
2. List every connection for the exact domain, following pagination. If none matches, inspect connections for the same profile and account before creating another: a site may redirect among sibling, tenant, or dedicated login hostnames. Reuse a known connection ID when the account context is unambiguous; do not assume arbitrary sibling subdomains belong to the same account.
3. If no relevant connection exists and the selected browser operation requires authentication, create one with a concise, stable profile name. A request to perform a task that clearly requires the user's site account is consent to check authentication; do not ask a redundant preliminary question.
4. If the connection is `AUTHENTICATED`, create a browser from its profile and verify by loading the target page. Do not keep using an unprofiled task browser. A stale status or redirect to login requires reauthentication.
5. If the selected browser operation requires authentication and no valid authenticated profile is available, call `login` once, expose the hosted URL through the host's user-visible mid-turn message mechanism, and immediately wait for the login in the same turn. Do not end the task or require the user to reply before waiting.
6. Continue waiting until `flow_status=SUCCESS` and `status=AUTHENTICATED`. If the flow expires, start a replacement flow, publish the new URL mid-turn, and resume waiting.
7. Create a new ordinary browser from the verified profile with browser telemetry enabled. Preserve any proxy required by the connection.
8. Continue the original task with whichever browser agent or control framework is already appropriate. Reuse the existing browser-agent stack by attaching it to the new authenticated session; managed auth does not require switching to Playwright or Kernel-native controls. Use semantic automation for structured control and assertions, and computer actions when actual pointer, keyboard, focus, selection, drag, compositor, or visual behavior matters.
9. Delete temporary and superseded task browsers when finished. Retain a reusable connection and profile unless the user asked for disposable authentication.

If Kernel MCP tools are available, prefer their typed operations: list/create/login/wait with the managed-auth tool, create/delete with the browser tool, Playwright for DOM-level control, and computer actions for OS-level input. Use the CLI workflow below as the fallback or when CLI-specific functionality is needed.

## Safe defaults

1. Set `KERNEL_PROJECT` once or pass global `--project <id-or-name>` to every command.
2. Reuse an existing connection for the same domain, account, and profile instead of creating duplicates.
3. Prefer credential references over putting secrets in command arguments, logs, chat, or shell history.
4. Treat hosted, live-view, and CDP URLs as sensitive. Suppress link unfurls and never expose them beyond the intended user.
5. Keep profile downloads outside repositories; they can contain cookies and authenticated browser state.
6. Delete temporary browsers and downloaded state. Do not delete a reusable connection or profile as routine cleanup or recovery.

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

The response tells you whether Kernel started a `LOGIN` or `REAUTH` flow and includes `hosted_url`, `live_view_url`, and `flow_expires_at`. The `live_view_url` belongs to the managed-auth browser, not any ordinary browser that triggered the login. Custom interfaces must keep the rendered live view and submitted interaction state bound to this active flow.

When a human must act, publish `hosted_url` as a user-visible mid-turn message such as:

> Login is needed to continue: `<hosted_url>`. I will continue automatically when it completes.

Keep the current turn active and begin following or waiting immediately after publishing the message. Do not put the URL only in the final response, ask the user to reply after login, or split the original task into a separate run. Suppress link unfurls and do not expose the live-view or CDP URL unless the intended user needs it.

Track the flow until it reaches a terminal state:

```bash
kernel auth connections follow "$CONNECTION_ID"
```

With a typed tool that offers bounded long-polling, repeatedly call its wait action until success, failure, or expiry. Preserve any returned flow checkpoint unchanged between calls. Do not infer completion from a successful submit or one non-terminal wait response.

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

Do not call `login` again while the current flow is non-terminal; use `follow`, wait, or get to observe progress. A new login supersedes the active flow and can invalidate input the user was about to submit. If a stale flow is past `flow_expires_at`, call `login` again to replace it. Do not delete the connection or profile just to refresh an expired flow.

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

Browser telemetry is opt-in and cannot backfill an earlier failure. Connection telemetry applies only to managed-auth sessions, so enable telemetry again when creating every ordinary profile-backed browser. For authenticated work that the agent may need to monitor or diagnose, capture the site-facing categories from the start:

```bash
kernel browsers create \
  --profile-name example-main \
  --telemetry=console,network,page,interaction \
  -o json
```

`all` means Kernel's default operational set and omits the debug-critical `console`, `network`, and `page` categories. Telemetry can contain sensitive site metadata; enable only what the task needs and do not paste raw events into chat or repositories. When a browser fails or behaves unexpectedly, load the `debug-browser-session` skill for event retrieval, category selection, telemetry gaps, and post-delete inspection.

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

## Use the authenticated browser

Create an ordinary browser from the authenticated profile with telemetry enabled. Add stealth, a proxy, profile saving, or a longer timeout only when the site or task needs them:

```bash
kernel browsers create \
  --profile-name example-main \
  --start-url https://example.com/account \
  --telemetry=console,network,page,interaction \
  -o json
```

Load the target page and verify authenticated state before doing consequential work. If the page redirects to login, reauthenticate the existing connection rather than creating another profile.

Choose controls based on the task:

- If the task already uses a browser agent or automation framework, keep using it and attach it to the authenticated browser through its supported session or CDP integration. Do not switch control stacks solely because authentication came from Kernel.
- Use Playwright for navigation, semantic locators, DOM state, extraction, and repeatable assertions.
- Use computer actions for real mouse and keyboard input, caret/focus behavior, text selection, drag and drop, native dialogs, compositor behavior, or visual reproduction. End action batches with a screenshot when the interface supports it.
- Combine them when useful: use Playwright to reach and inspect a state, computer actions to reproduce real input, then Playwright and telemetry to verify the result.
- Use a site-specific or QA skill for domain logic or test planning; this skill remains responsible for authentication, profile reuse, and the browser handoff.

Delete the temporary browser when finished. Telemetry captured before deletion remains available for later inspection:

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
