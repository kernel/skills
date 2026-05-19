---
name: debug-browser-session
description: Debug Kernel browser session issues client-side — CDP connection drops, mid-session disconnects, and unrecoverable WebSocket errors. Use when a Playwright or CDP-based script fails partway through a session.
context: fork
---

# Debug Kernel Browser Sessions

When a browser session hits errors like `Connection closed while reading from the driver`, `Target closed`, or CDP attaches that fail after a previously healthy connection, use this skill to narrow down whether the issue is in your script, your network, or Kernel's infra.

## When to Use

- Long-running sessions that drop CDP partway through
- `connect_over_cdp` / `connectOverCDP` reconnects that fail repeatedly
- Intermittent "session closed" errors that don't reproduce locally
- Before opening a support ticket — the data this skill produces makes triage dramatically faster

## Step 1: Capture Playwright debug logs

Set the `DEBUG` env var before running your script:

```bash
DEBUG=pw:browser*,pw:protocol* node your-script.js
```

```bash
DEBUG=pw:browser*,pw:protocol* python your_script.py
```

Reproduce the failure, then capture the last 50–100 lines of stderr/stdout. Those logs include the exact moment the WebSocket closed and which side initiated it.

> **⚠️ Redact before sharing.** `pw:protocol` output includes Network events with full URLs, request/response headers, cookies, and `Authorization` values. Before pasting logs into a support thread or public issue, scrub headers (`cookie`, `authorization`, `set-cookie`, custom auth tokens), query strings, and any body payloads. If the failure path runs against production data, prefer reproducing against a test environment, or send only the close/error lines (the `WebSocket closed` / `Connection closed` lines and ~5–10 surrounding lines) — that's usually enough to identify which side initiated the close.

### Interpreting the output

| Pattern in logs | What it means | Next step |
| --- | --- | --- |
| Client closed first (your code or process sent the close) | Local issue — process killed, OS killing the socket, app-level timeout | Check your script's lifecycle, OS signals, timeouts |
| Server closed first (Kernel sent a close frame) | Something on Kernel's side ended the session | Share logs with Kernel support |
| No close frame, just dies (raw TCP EOF / timeout) | A middlebox in between (NAT, firewall, ISP, cloud egress) killed the long-lived WS | Add keepalives, try a different network path, or move execution closer to Kernel |

## Step 2: Add CDP reconnect retries

CDP connections over the public internet are subject to ordinary network flakiness. Wrap CDP-dependent operations in a retry helper so a transient drop doesn't kill the run:

```typescript
async function withCDPRetry(fn, { maxRetries = 2, delayMs = 2000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(page);
    } catch (err) {
      const isDisconnect = /closed|crashed|Target page/i.test(err.message);
      if (!isDisconnect || attempt >= maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
      const browser = await chromium.connectOverCDP(cdpWsUrl);
      const context = browser.contexts()[0];
      page = context.pages()[0] || (await context.newPage());
    }
  }
}
```

## Step 3: Prefer server-side Playwright execution

If you're regularly hitting CDP drops on long-running scripts, consider switching from client-side `connectOverCDP` to server-side execution with `kernel.browsers.playwright.execute()`. Your code runs inside the browser VM, so the CDP connection is local rather than crossing the public internet — eliminating the most common class of mid-session drops. See the `kernel-typescript-sdk` and `kernel-python-sdk` skills for usage.

## Step 4: Enable session replays

For sessions where the failure is visual (page state, element not found, bot challenge), turn on replays before reproducing:

```typescript
const replay = await kernel.browsers.replays.start(browser.session_id);
// ... run automation ...
await kernel.browsers.replays.stop(replay.replay_id, { id: browser.session_id });
```

The MP4 makes it obvious whether the page got into the expected state before the failure. See https://www.kernel.sh/docs/browsers/replays.

## What to share with Kernel support

If after the above the failure still looks like a Kernel-side issue, share:

1. The session ID (`browser.session_id`)
2. The approximate UTC timestamp of the failure
3. The last 50–100 lines of `DEBUG=pw:browser*,pw:protocol*` output
4. The replay ID (if you captured one)

That's enough to correlate against server logs and identify the root cause quickly.
