---
name: debug-browser-session
description: Systematically debug a Kernel cloud browser session — VM issues, network errors, Chrome crashes, page-load failures, and live-view problems. Use when a browser session misbehaves (e.g. ERR_HTTP2_PROTOCOL_ERROR, "browser not responding", blank/error pages, captcha or "checking your browser" blocks, live view not loading) and you have the session ID. Drives the Kernel CLI to inspect session status, screenshots, page state, VM logs, and network connectivity.
---

# Debug a Kernel Browser Session

Diagnose a misbehaving Kernel cloud browser session using the Kernel CLI. The CLI has full access to the session's VM — status, screenshots, Playwright execution, log files, and in-VM command execution — which is everything you need to localize a failure to bot detection, a Chrome crash, a network/DNS problem, or live-view/WebRTC issues.

## Inputs

Two things drive the investigation:

1. **Session ID** — the browser session to debug (e.g. `abc123example456xyz`).
2. **Issue description** — what's going wrong (e.g. "ERR_HTTP2_PROTOCOL_ERROR navigating to a specific site", "browser not responding", "page not loading", "live view is blank").

If either is missing, ask for it before proceeding. The issue description determines which checks below to weight.

## Prerequisites

Install and authenticate the Kernel CLI:

```bash
brew install onkernel/tap/kernel    # or: npm install -g @onkernel/cli
kernel auth status                  # confirm you're logged in (or KERNEL_API_KEY is set)
```

Explore commands recursively when you need options:

```bash
kernel --help
kernel browsers --help
kernel browsers fs --help
kernel browsers process --help
kernel browsers playwright --help
```

## Core CLI commands

Substitute your session ID for `<SESSION_ID>`.

### Session status
```bash
kernel browsers get <SESSION_ID>
```

### Screenshot the current state
```bash
kernel browsers screenshot <SESSION_ID>
```

### Inspect page state via Playwright
```bash
kernel browsers playwright execute <SESSION_ID> "return { url: page.url(), title: await page.title() }"
```

### Read VM log files
```bash
kernel browsers fs read-file <SESSION_ID> --path /var/log/supervisord.log
kernel browsers fs read-file <SESSION_ID> --path /var/log/supervisord/chromium
kernel browsers fs read-file <SESSION_ID> --path /var/log/supervisord/neko
```

### List files in the VM
```bash
kernel browsers fs ls <SESSION_ID> --path /var/log
```

### Run commands inside the VM
```bash
kernel browsers process exec <SESSION_ID> -- curl -I https://example.com
kernel browsers process exec <SESSION_ID> -- cat /etc/resolv.conf
```

### Check cookies via Playwright
```bash
kernel browsers playwright execute <SESSION_ID> "const cookies = await page.context().cookies(); return { count: cookies.length, domains: [...new Set(cookies.map(c => c.domain))] }"
```

## Common issues & solutions

### Network errors (ERR_HTTP2_PROTOCOL_ERROR, ERR_CONNECTION_RESET, etc.)
Bot detection is a common cause. Many sites use CDNs like Cloudflare, Imperva, or Akamai that fingerprint browsers and block automation.

Signs of bot detection:
- `curl` works from the VM but Chrome shows an error
- "Access Denied", captcha pages, or "Checking your browser…" messages
- `stealth: false` in the browser config (check with `kernel browsers get`)

Solutions: enable `stealth: true`, use profiles with real auth, or try shorter session lifetimes.

### Browser not responding
Cause: Chrome process crashed or hung.
Check: supervisor logs for chromium restart events.
Solutions: confirm the timeout wasn't reached, look for memory issues in the logs, create a new session.

### Page not loading
Cause: network, DNS, or proxy issues.
Check: `curl` from inside the VM, `/etc/resolv.conf` for DNS config, proxy settings if one is configured.

### Live view not working
Cause: Neko/WebRTC issues.
Check: Neko logs for connection errors.
Solutions: check for a firewall blocking WebRTC, verify the browser isn't in headless mode.

## Expected log entries (normal operation)

These are normal and don't indicate problems:
- `Failed to call method: org.freedesktop.DBus.Properties.GetAll` — DBus permission (expected in container)
- `vkCreateInstance: Found no drivers` — no GPU in the VM (expected)
- `DEPRECATED_ENDPOINT` for GCM — Google deprecation (harmless)
- `SharedImageManager::ProduceMemory` errors — GPU-related (not critical)

## Debugging checklist

- [ ] Session exists and is active
- [ ] Screenshot shows expected content (or reveals the error)
- [ ] Current URL is as expected
- [ ] Supervisor logs show all services running
- [ ] Network connectivity works (curl test)
- [ ] No critical errors in chromium logs
- [ ] Cookies/session state are correct

## Suggested order

1. Get browser info to confirm the session is active.
2. Take a screenshot to see the current state.
3. Check the page URL to see whether it's on an error page.
4. Test network connectivity if seeing connection errors.
5. Review logs for specific error patterns.
