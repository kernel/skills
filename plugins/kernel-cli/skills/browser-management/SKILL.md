---
name: kernel-browser-management
description: Create, list, view, and delete Kernel browser sessions with various configuration options
allowed_tools:
  - create_browser
  - get_browser
  - list_browsers
  - delete_browser
  - execute_playwright_code
  - take_screenshot
---

# Browser Management

Create and manage sandboxed Chrome browser instances in the cloud.

## Create a Browser

```bash
# Basic browser creation (returns session info)
kernel browsers create -o json

# With options
kernel browsers create --stealth --headless -o json
kernel browsers create --timeout 3600 -o json          # 1 hour timeout
kernel browsers create --profile-name my-profile -o json

# From a browser pool
kernel browsers create --pool-name my-pool -o json
```

Output contains `session_id`, `cdp_ws_url`, and `browser_live_view_url`.

**MCP Tool:** Use `create_browser` with parameters like `headless`, `stealth`, `timeout_seconds`, `profile_name`, or `profile_id`.

## List and Get Browsers

```bash
kernel browsers list -o json
kernel browsers get <session_id> -o json
kernel browsers view <session_id> -o json    # Get live view URL
```

**MCP Tools:**
- `list_browsers` - List all active browser sessions
- `get_browser` - Get detailed info for a specific session

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
