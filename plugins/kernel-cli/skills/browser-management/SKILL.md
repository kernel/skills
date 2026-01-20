---
name: kernel-browser-management
description: Create, list, view, and delete Kernel browser sessions with various configuration options
allowed-tools: create_browser, get_browser, list_browsers, delete_browser, execute_playwright_code, take_screenshot
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

## Create a Browser

```bash
# Basic browser creation
kernel browsers create

# With options
kernel browsers create --stealth --headless -o json
kernel browsers create --profile-name my-profile
```

Output contains `session_id`, `cdp_ws_url`, and `browser_live_view_url`.

**MCP Tool:** Use `create_browser` with parameters like `headless`, `stealth`, or `profile_name`.

## List and Get Browsers

<Info>Unless otherwise noted, `id` arguments refer to the browser session ID, not invocation IDs returned by Kernel commands.</Info>

```bash
kernel browsers list -o json
kernel browsers get <session_id> -o json
kernel browsers view <session_id> -o json    # Get live view URL
```

**MCP Tools:** Use `list_browsers`, `get_browser`.

## Delete a Browser

```bash
kernel browsers delete <session_id> --yes
```

**MCP Tool:** Use `delete_browser` with the `session_id`.

## Browser Automation

### Execute Playwright Code

Run Playwright/TypeScript code against a browser session:

```bash
kernel browsers playwright execute <session_id> 'await page.goto("https://example.com")'
```

**MCP Tool:** Use `execute_playwright_code` to run automation scripts. If no `session_id` is provided, a new browser is created and cleaned up automatically.

### Take Screenshots

Capture screenshots of browser pages:

```bash
kernel browsers computer screenshot <session_id> --to screenshot.png
```

**MCP Tool:** Use `take_screenshot` with `session_id`. Optionally specify region with `x`, `y`, `width`, `height`.

## Common Pattern: Create, Use, Delete

```bash
# Create browser and capture session_id
SESSION=$(kernel browsers create -o json | jq -r '.session_id')

# Use the browser...
# [perform operations]

# Cleanup
kernel browsers delete $SESSION --yes
```
