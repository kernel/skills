---
name: kernel-browser-telemetry
description: Console, network, page, interaction, and operational events for a browser session — read historically or stream live to confirm state faster than screenshots alone
---

# Browser Telemetry

Structured, timestamped events emitted from inside a browser session: console output,
network activity, page lifecycle, user interaction, CAPTCHA results, and VM-level
signals (crashes, connect/disconnect).

## When to Use

Always pair telemetry with screenshots — they answer different questions:

- **Telemetry**: *did the thing happen, when, and why* — a `page_load` event proves
  navigation finished; a `console_error` proves a script broke; `network_idle` proves
  requests have settled. Structured and queryable, no image interpretation needed.
- **Screenshots**: *what does it look like* — layout, visual bugs, CAPTCHA appearance,
  whether a click landed on the right pixel.

Check telemetry first to confirm state, and reach for a screenshot only when you need
to *see* something telemetry can't tell you. This replaces blind `sleep` + screenshot
polling for:

- A navigation completed (`page_navigation` → `page_dom_content_loaded` → `page_load`)
- The network has settled before scraping (`network_idle`)
- A script or page threw an error (`console_error`)
- An automated CAPTCHA solve succeeded or failed (`captcha_solve_result`)
- A crash or resource issue occurred (`system_oom_kill`, `service_crashed`)
- CDP/live-view connections dropped mid-task (`cdp_disconnect`, `live_view_disconnect`)

## Prerequisites

Load the `kernel-cli` skill for installation and authentication. Telemetry is opt-in
and category-based — enable it at session creation:

```bash
# Default operational set (control, connection, system, captcha)
kernel browsers create --telemetry=all -o json

# Explicit categories — add browser-activity categories you need
kernel browsers create --telemetry=console,network,page,interaction,screenshot -o json

# Disable entirely
kernel browsers create --telemetry=off -o json
```

`--telemetry=all` enables the default *operational* set, not literally every category —
request `console`, `network`, `page`, `interaction`, `screenshot` explicitly for
browser-activity signals too. Change categories on a running session with
`kernel browsers update <id> --telemetry=...`.

## Categories

| Category | What it captures | Event types |
|---|---|---|
| `control` | Computer-control API calls against the session | `api_call` |
| `connection` | CDP / live-view connect and disconnect | `cdp_connect`, `cdp_disconnect`, `live_view_connect`, `live_view_disconnect` |
| `system` | VM-level failures | `system_oom_kill`, `service_crashed` |
| `captcha` | Automated CAPTCHA solve results | `captcha_solve_result` |
| `console` | Console output from the page | `console_log`, `console_error` |
| `network` | Requests, responses, failures, idle | `network_request`, `network_response`, `network_loading_failed`, `network_idle` |
| `page` | Navigation and lifecycle, incl. performance | `page_navigation`, `page_dom_content_loaded`, `page_load`, `page_tab_opened`, `page_layout_shift`, `page_lcp`, `page_layout_settled`, `page_navigation_settled` |
| `interaction` | Browser-native input (click, key, scroll) | `interaction_click`, `interaction_key`, `interaction_scroll_settled` |
| `screenshot` | Periodic screenshots of the session | `monitor_screenshot` |

`control`, `connection`, `system`, `captcha` are the default operational set. The rest
must be requested explicitly.

## Reading Historical Events

```bash
# Last 5 minutes (default window), first page
kernel browsers telemetry events <session_id> -o json

# Filtered to specific categories, explicit window
kernel browsers telemetry events <session_id> --since 2m --categories=network,console -o json

# Specific event types, walking all pages
kernel browsers telemetry events <session_id> --since 10m --types=network_response,console_error --all -o json

# Resume from a pagination cursor
kernel browsers telemetry events <session_id> --offset <X-Next-Offset-from-previous-response>
```

`--since`/`--until` accept RFC-3339 timestamps or durations (`5m`). `--limit` caps
events per page (1-100, default 20); `--all` walks every page instead of just the first.

## Streaming Live Events

```bash
# Stream everything from now
kernel browsers telemetry stream <session_id>

# Filter by category or type
kernel browsers telemetry stream <session_id> --categories=network,console
kernel browsers telemetry stream <session_id> --types=network_response,console_error

# Machine-readable (newline-delimited JSON envelopes)
kernel browsers telemetry stream <session_id> -o json

# Replay from the oldest retained event instead of from now
kernel browsers telemetry stream <session_id> --replay=all

# Resume after a dropped connection without gaps
kernel browsers telemetry stream <session_id> --seq 1024
```

Each envelope is `{"seq": <int>, "event": {...}}` — `event.category` and `event.type`
discriminate the payload; `event.data` holds type-specific fields. The stream stays
open until the session terminates; keepalive frames arrive every 15s with no events.

## Common Pattern: Telemetry-Confirmed Navigation

Replace blind `waitForTimeout` + screenshot with a telemetry check:

```bash
SESSION=$(kernel browsers create --telemetry=console,network,page -o json | jq -r '.session_id')

kernel browsers playwright execute $SESSION 'await page.goto("https://example.com")'

# Confirm the navigation actually completed, and check for JS errors, in one read
kernel browsers telemetry events $SESSION --since 30s --types=page_load,console_error -o json

# Only screenshot once telemetry confirms load finished, and only if you need to *see* it
kernel browsers computer screenshot $SESSION --to page.png

kernel browsers delete $SESSION
```
