---
name: kernel-browser-management
description: create, list, view, and delete KERNEL browser sessions with various configuration options
---

# Browser Management

create and manage sandboxed Chrome browser instances in the cloud.

## when to use this skill

use browser-management skill when you need to:

- **create browser sessions** - launch new Chrome browser instances with custom configurations (stealth mode, headless, profiles, proxies)
- **list and monitor browsers** - view all active browser sessions and their details
- **get live view urls** - access remote browser sessions for monitoring and control
- **execute automation** - run Playwright/TypeScript code against browser sessions
- **capture screenshots** - take screenshots of browser pages or specific regions
- **manage browser lifecycle** - delete browser sessions when done to free resources
- **work with browser profiles** - load saved authentication data and cookies into sessions
- **ssh & port forwarding** - ssh into browser vms, forward local dev servers to the browser, or access vm services locally

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## create a browser

```bash
# Basic browser creation
kernel browsers create -o json

# With options
kernel browsers create --stealth --headless -o json
kernel browsers create --profile-name my-profile -o json
```

output contains `session_id`, `cdp_ws_url`, and `browser_live_view_url`.

**mcp tool:** use `kernel:create_browser` with parameters like `headless`, `stealth`, or `profile_name`.

## list and get browsers

<Info>unless otherwise noted, `id` arguments refer to the browser session id, not invocation ids returned by KERNEL commands.</Info>

```bash
kernel browsers list -o json
kernel browsers get <session_id> -o json
kernel browsers view <session_id> -o json    # Get live view URL
```

**mcp tools:** use `kernel:list_browsers`, `kernel:get_browser`.

## update a browser

```bash
# Bypass the default stealth proxy and connect directly
kernel browsers update <session_id> --disable-default-proxy -o json

# Restore the default stealth proxy
kernel browsers update <session_id> --disable-default-proxy=false -o json
```

this controls KERNEL's default stealth proxy. use `--proxy-id` or `--clear-proxy` to manage an explicitly assigned proxy instead.

## delete a browser

```bash
kernel browsers delete <session_id>
```

**mcp tool:** use `kernel:delete_browser` with the `session_id`.

## browser automation

### execute Playwright code

run Playwright/TypeScript code against a browser session:

```bash
kernel browsers playwright execute <session_id> 'await page.goto("https://example.com")'
```

use `return` to get a value back from the execution context:

```bash
kernel browsers playwright execute <session_id> '
  await page.goto("https://example.com");
  return await page.evaluate(() => document.title);
'
```

**mcp tool:** use `kernel:execute_playwright_code` to run automation scripts. if no `session_id` is provided, a new browser is created and cleaned up automatically.

### take screenshots

capture screenshots of browser pages:

```bash
kernel browsers computer screenshot <session_id> --to screenshot.png
```

**mcp tool:** use `kernel:take_screenshot` with `session_id`. optionally specify region with `x`, `y`, `width`, `height`.

## ssh access & port forwarding

ssh into a running browser vm for debugging, running commands, or exposing a local dev server.

requires [websocat](https://github.com/vi/websocat) (`brew install websocat` on macOS).

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

ssh connections alone don't count as browser activity. set `--timeout` when creating the browser or keep the live view open to prevent cleanup.

**mcp tool:** use `kernel:create_browser` with `remote_forward` (e.g., `3000:localhost:3000`) or `local_forward` to include the ssh command in the response.

## common pattern: create, use, delete

```bash
# Create browser and capture session_id
SESSION=$(kernel browsers create -o json | jq -r '.session_id')

# Use the browser...
# [perform operations]

# Cleanup
kernel browsers delete $SESSION
```
