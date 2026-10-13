---
name: debug-browser-session
description: systematically debug a KERNEL cloud browser session — vm issues, network errors, Chrome crashes, page-load failures, and live-view problems. use when a browser session misbehaves (e.g. ERR_HTTP2_PROTOCOL_ERROR, "browser not responding", blank/error pages, captcha or "checking your browser" blocks, live view not loading) and you have the session id. drives the KERNEL cli to inspect session status, screenshots, page state, vm logs, network connectivity, and telemetry events (which remain readable even after the session is deleted).
---

# debug a KERNEL browser session

diagnose a misbehaving KERNEL cloud browser session using the KERNEL cli. the cli has full access to the session's vm — status, screenshots, Playwright execution, log files, and in-vm command execution — which is everything you need to localize a failure to bot detection, a Chrome crash, a network/dns problem, or live-view/WebRTC issues.

## inputs

two things drive the investigation:

1. **session id** — the browser session to debug (e.g. `abc123example456xyz`).
2. **issue description** — what's going wrong (e.g. "ERR_HTTP2_PROTOCOL_ERROR navigating to a specific site", "browser not responding", "page not loading", "live view is blank").

if either is missing, ask for it before proceeding. the issue description determines which checks below to weight.

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication. its references cover the full command surface (`browser-management`, `filesystem-ops`, `process-execution`, `computer-controls`) when you need options beyond the ones below.

## core cli commands

substitute your session id for `<SESSION_ID>`.

### session status
```bash
kernel browsers get <SESSION_ID> -o json

# If the normal lookup returns not found, recover the soft-deleted record by session ID.
kernel browsers get <SESSION_ID> --include-deleted -o json
```

the deleted record provides static configuration and timestamps such as `created_at` and `deleted_at`; vm, Playwright, screenshot, curl, log, and live-view commands still require a live session.

### screenshot the current state
```bash
kernel browsers computer screenshot <SESSION_ID> --to screenshot.png
```

### inspect page state via Playwright
```bash
kernel browsers playwright execute <SESSION_ID> "return { url: page.url(), title: await page.title() }"
```

### read browser service logs
```bash
kernel browsers logs stream <SESSION_ID> --source supervisor --supervisor-process chromium --follow=false
kernel browsers logs stream <SESSION_ID> --source supervisor --supervisor-process neko --follow=false
```

for other vm logs, list and read files directly:

```bash
kernel browsers fs list-files <SESSION_ID> --path /var/log
kernel browsers fs read-file <SESSION_ID> --path /var/log/supervisord.log
```

### compare Chrome and vm network paths
```bash
# Uses Chrome's TLS fingerprint, cookies, headers, and proxy configuration.
kernel browsers curl <SESSION_ID> https://example.com -I -w 'status=%{http_code} total=%{time_total}\n'

# Uses curl inside the VM instead of Chrome's network stack.
kernel browsers process exec <SESSION_ID> -- curl -I https://example.com
kernel browsers process exec <SESSION_ID> -- cat /etc/resolv.conf
```

### check cookies via Playwright
```bash
kernel browsers playwright execute <SESSION_ID> "const cookies = await page.context().cookies(); return { count: cookies.length, domains: [...new Set(cookies.map(c => c.domain))] }"
```

## browser telemetry events (works even after deletion)

telemetry only helps if it was enabled before the failure — capture is off by default. when it was on, captured events stay readable after telemetry is disabled or the session is deleted. a soft-deleted session's static record is also available with `kernel browsers get <SESSION_ID> --include-deleted`; runtime inspection still needs a live session.

the debug-critical categories are console (console output and uncaught exceptions), network (request/response metadata), and page (navigation and lifecycle). high-signal event types: console_error, network_loading_failed, network_response with non-2xx status, system_oom_kill, and monitor_disconnected (telemetry gap — treat following events as incomplete). for the full category and event-type catalog, see the [telemetry categories docs](https://docs.onkernel.com/browsers/telemetry/categories).

### read events
```bash
kernel browsers telemetry events <SESSION_ID> --since 24h --all
kernel browsers telemetry events <SESSION_ID> --since 24h --categories console,network --all
kernel browsers telemetry events <SESSION_ID> --since 24h --types console_error,network_loading_failed
```

`--since` accepts an rfc-3339 timestamp or a duration like `5m`, and **defaults to the last 5 minutes**. when in doubt, use a generous window like `--since 24h` (as in the examples); for a deleted session, use `browsers get --include-deleted` to recover its `created_at` and bound the window precisely. `--all` walks every page in the window (default is one page of 20 events, `--limit` up to 100, with an `--offset` cursor for manual paging); a `--types` filter walks the whole window automatically. use `-o json` for full event payloads — the default table shows only sequence, time, category, and type, so anything that depends on event contents (a `network_response` status code, a console error message, a url) requires json output. the same events are available via the api/sdk (`GET /browsers/{session_id}/telemetry/events`, which has the same 5-minute `since` default) and — if your KERNEL mcp server build includes it — the `manage_browsers` tool's `get_telemetry` action (which defaults to the full session window). for a live session, `kernel browsers telemetry stream <SESSION_ID>` tails events as they happen.

### enable capture
```bash
kernel browsers create --telemetry=console,network,page
kernel browsers update <SESSION_ID> --telemetry=console,network,page
```

capture starts the moment it's enabled and can't backfill. for automations you expect to debug, enable telemetry (including `console`, `network`, `page`) at create time so the evidence exists when something fails; on a live session, enable the categories, reproduce the issue, then read the events.

gotchas:

- **telemetry is opt-in.** no events may just mean it was never enabled — not that nothing happened.
- **the default bundle omits the debug-critical categories (`console`, `network`, `page`).** `--telemetry=all` captures control/connection/system/captcha only; request `console`, `network`, and `page` explicitly (as above) when you need those signals.
- **`monitor_disconnected` marks a telemetry gap.** the collector dropped; treat console/network/page/interaction coverage as incomplete until the next `monitor_reconnected`, or through the end of the event history if none appears.

## common issues & solutions

### network errors (ERR_HTTP2_PROTOCOL_ERROR, ERR_CONNECTION_RESET, etc.)
bot detection is a common cause. many sites use cdns like Cloudflare, Imperva, or Akamai that fingerprint browsers and block automation.

signs of bot detection:
- vm `curl` works but the page or `kernel browsers curl` fails
- "Access Denied", captcha pages, or "Checking your browser…" messages
- `stealth: false` in the browser config

check `kernel browsers get <SESSION_ID> -o json` for `stealth` and an explicit `proxy_id`. if a stealth session is expected to use KERNEL's default proxy, isolate that route only after capturing the screenshot, telemetry, and logs:

```bash
# This mutates live routing.
kernel browsers update <SESSION_ID> --disable-default-proxy
# Reproduce the failing request once and capture the result.
kernel browsers update <SESSION_ID> --disable-default-proxy=false
```

only run this A/B test when the session owner confirms the default proxy should currently be enabled, because `browsers get` does not expose the prior `disable_default_proxy` state. do not substitute `--clear-proxy`; that removes an explicit proxy. restore the default proxy regardless of the result; if direct routing fixed the failure, investigate the proxy path.

stealth is set at creation and can't be toggled on a live session. if you create a stealth replacement to reproduce, preserve the original session and delete only the diagnostic replacement when done:

```bash
kernel browsers delete <DIAGNOSTIC_SESSION_ID>
```

### browser not responding
cause: Chrome process crashed or hung.
check: supervisor logs for Chromium restart events.
solutions: confirm the timeout wasn't reached, look for memory issues in the logs, create a new session.

### page not loading
cause: network, dns, or proxy issues.
check: compare `kernel browsers curl` with vm `curl`, inspect `/etc/resolv.conf`, then inspect the configured proxy. a Chrome-only failure points toward Chrome state, tls fingerprinting, cookies, or its proxy route; failure in both paths points lower in the vm/network stack.

### live view not working
cause: Neko/WebRTC issues.
check: fetch the live view url with `kernel browsers view <SESSION_ID>` and open it; read Neko logs with `browsers logs stream`; verify `headless` is false in `browsers get`.
solutions: check for a firewall blocking WebRTC and compare whether Playwright and screenshots still work. if they do, the browser is healthy and the fault is isolated to live view.

## expected log entries (normal operation)

these are normal and don't indicate problems:
- `Failed to call method: org.freedesktop.DBus.Properties.GetAll` — DBus permission (expected in container)
- `vkCreateInstance: Found no drivers` — no gpu in the vm (expected)
- `DEPRECATED_ENDPOINT` for GCM — Google deprecation (harmless)
- `SharedImageManager::ProduceMemory` errors — gpu-related (not critical)

## debugging checklist

- [ ] active session found, or deleted metadata recovered with `--include-deleted`
- [ ] screenshot shows expected content (or reveals the error)
- [ ] current url is as expected
- [ ] supervisor logs show all services running
- [ ] Chrome-stack and vm curl results compared
- [ ] no critical errors in Chromium logs
- [ ] cookies/session state are correct
- [ ] telemetry events checked for console_error / network_loading_failed / system events (especially if the session is gone)
- [ ] any temporary default-proxy change restored; any diagnostic replacement deleted

## suggested order

1. get browser info; retry with `--include-deleted` if it is gone.
2. preserve evidence: screenshot, url/title, telemetry, then logs.
3. compare Chrome-stack curl with vm curl for connection failures.
4. reproduce once; only then run a temporary default-proxy A/B test if relevant.
5. restore changed routing and delete any diagnostic replacement session.

if the session is deleted, recover its static metadata with `browsers get --include-deleted`; telemetry is the remaining runtime signal, and only if capture was enabled while it ran.
