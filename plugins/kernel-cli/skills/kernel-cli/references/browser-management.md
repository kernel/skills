---
name: kernel-browser-management
description: Create, list, view, and delete Kernel browser sessions with various configuration options
---

# Browser Management

Create and manage sandboxed Chrome browser instances in the cloud.

## When to Use This Skill

Use browser-management skill when you need to:

- **Create browser sessions** - Launch new Chrome browser instances with custom configurations (stealth mode, headless, profiles, proxies)
- **List and monitor browsers** - View all active browser sessions and their details
- **Get live view URLs** - Access remote browser sessions for monitoring and control
- **Execute automation** - Run Playwright/TypeScript code against browser sessions
- **Capture screenshots** - Take screenshots of browser pages or specific regions
- **Manage browser lifecycle** - Delete browser sessions when done to free resources
- **Work with browser profiles** - Load saved authentication data and cookies into sessions
- **SSH & port forwarding** - SSH into browser VMs, forward local dev servers to the browser, or access VM services locally

## Prerequisites

Load the `kernel-cli` skill for Kernel CLI installation and authentication.

## Create a Browser

```bash
# Basic browser creation
kernel browsers create

# With options
kernel browsers create --stealth --headless -o json
kernel browsers create --profile-name my-profile
```

Output contains `session_id`, `cdp_ws_url`, and `browser_live_view_url`.

**MCP Tool:** Use `kernel:create_browser` with parameters like `headless`, `stealth`, or `profile_name`.

## List and Get Browsers

<Info>Unless otherwise noted, `id` arguments refer to the browser session ID, not invocation IDs returned by Kernel commands.</Info>

```bash
kernel browsers list -o json
kernel browsers get <session_id> -o json
kernel browsers view <session_id> -o json    # Get live view URL
```

**MCP Tools:** Use `kernel:list_browsers`, `kernel:get_browser`.

## Delete a Browser

```bash
kernel browsers delete <session_id> --yes
```

**MCP Tool:** Use `kernel:delete_browser` with the `session_id`.

## Browser Automation

### Execute Playwright Code

Run Playwright/TypeScript code against a browser session:

```bash
kernel browsers playwright execute <session_id> 'await page.goto("https://example.com")'
```

**MCP Tool:** Use `kernel:execute_playwright_code` to run automation scripts. If no `session_id` is provided, a new browser is created and cleaned up automatically.

### Take Screenshots

Capture screenshots of browser pages:

```bash
kernel browsers computer screenshot <session_id> --to screenshot.png
```

**MCP Tool:** Use `kernel:take_screenshot` with `session_id`. Optionally specify region with `x`, `y`, `width`, `height`.

## SSH Access & Port Forwarding

SSH into a running browser VM for debugging, running commands, or exposing a local dev server.

Requires [websocat](https://github.com/vi/websocat) (`brew install websocat` on macOS).

```bash
# Open an interactive SSH shell
kernel browsers ssh <session_id>

# Forward local dev server (port 3000) into the browser VM
kernel browsers ssh <session_id> -R 3000:localhost:3000

# Forward a VM port to your local machine
kernel browsers ssh <session_id> -L 5432:localhost:5432

# Use an existing SSH key instead of generating an ephemeral one
kernel browsers ssh <session_id> -i ~/.ssh/id_ed25519

# Setup SSH on the VM without connecting (prints manual connection command)
kernel browsers ssh <session_id> --setup-only
```

SSH connections alone don't count as browser activity. Set `--timeout` when creating the browser or keep the live view open to prevent cleanup.

**MCP Tool:** Use `kernel:create_browser` with `remote_forward` (e.g., `3000:localhost:3000`) or `local_forward` to include the SSH command in the response.

## Common Pattern: Create, Use, Delete

```bash
# Create browser and capture session_id
SESSION=$(kernel browsers create -o json | jq -r '.session_id')

# Use the browser...
# [perform operations]

# Cleanup
kernel browsers delete $SESSION --yes
```
