---
name: kernel-agent-browser
description: Best practices for using agent-browser with Kernel cloud browsers. Use when automating websites with agent-browser -p kernel, dealing with bot detection, iframes, login persistence, or needing to find Kernel browser session IDs and live view URLs.
---

# Agent-Browser with Kernel Cloud Browsers

This skill documents best practices for using agent-browser's built-in Kernel provider (`-p kernel`) for cloud browser automation.

## When to Use This Skill

Use this skill when you need to:

- **Automate websites** using `agent-browser -p kernel` commands
- **Handle bot detection** on sites with aggressive anti-bot measures
- **Persist login sessions** across automation runs using profiles
- **Work with iframes** including cross-origin payment forms
- **Get live view URLs** for debugging or manual intervention
- **Find the underlying Kernel session ID** for advanced Playwright scripting

## Prerequisites

Load the `kernel-cli` skill for Kernel CLI installation and authentication.

## Environment Variables

Set these before your first `agent-browser -p kernel` call. The CLI holds state between invocations.

| Variable | Description | Default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **Required.** Your Kernel API key for authentication | (none) |
| `KERNEL_HEADLESS` | Run browser in headless mode (`true`/`false`) | `false` |
| `KERNEL_STEALTH` | Enable stealth mode to avoid bot detection (`true`/`false`) | `true` |
| `KERNEL_TIMEOUT_SECONDS` | Session timeout in seconds | `300` |
| `KERNEL_PROFILE_NAME` | Browser profile name for persistent cookies/logins | (none) |

### Recommended Configuration

```bash
export KERNEL_API_KEY="your-api-key"
export KERNEL_TIMEOUT_SECONDS=600     # 10-minute timeout for complex workflows
export KERNEL_STEALTH=true            # Avoid bot detection (default)
export KERNEL_PROFILE_NAME=mysite     # Persist login sessions across runs
```

### Profile Persistence

When `KERNEL_PROFILE_NAME` is set:
- The profile is created if it doesn't exist
- Cookies, logins, and session data are automatically saved when the browser session ends
- Future sessions with the same profile name restore the saved state

This is especially useful for sites requiring login—authenticate once, reuse across sessions.

## Basic Usage

```bash
agent-browser -p kernel open <url>        # Navigate to page
agent-browser -p kernel snapshot -i       # Get interactive elements with refs
agent-browser -p kernel click @e1         # Click element by ref
agent-browser -p kernel fill @e2 "text"   # Fill input by ref
agent-browser -p kernel close             # Close browser and save profile
```

Always use the `-p kernel` flag with each command.

## Finding Session ID and Live View URL

agent-browser creates a Kernel browser session under the hood. To get the session ID or live view URL:

```bash
# List all Kernel browsers (find yours by profile name or creation time)
kernel browsers list

# Get live view URL for a specific session
kernel browsers view <session-id>
```

This is useful when:
- You need to execute Playwright scripts directly against the session
- You want to share a live view URL with the user for manual intervention
- You're debugging and want to watch the browser in real-time

## Handling Bot Detection

### Stealth Mode

Stealth mode (`KERNEL_STEALTH=true`) is enabled by default and helps avoid detection. However, some sites have aggressive bot detection that still triggers.

### Manual Login Fallback

If login automation fails due to bot detection:

1. Get the live view URL:
   ```bash
   kernel browsers list
   # Find your session by profile name
   kernel browsers view <session-id>
   ```

2. Share the live view URL with the user and ask them to complete the login manually

3. Once logged in, continue automation—the profile will save the authenticated state

### JavaScript Fallback for Tricky Elements

Some elements (especially on bot-protected sites) don't respond to standard commands:

```bash
# Click by CSS selector
agent-browser -p kernel eval "document.querySelector('.submit-btn').click()"

# Fill by selector (with event dispatch)
agent-browser -p kernel eval "
  const el = document.querySelector('#email');
  el.value = 'user@example.com';
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
"

# Click by test ID
agent-browser -p kernel eval "document.querySelector('[data-testid=\"submit\"]').click()"
```

### Anti-Bot Form Fields

Some payment processors (e.g., Point and Pay) use decoy form fields. Only fill fields matching specific patterns:

```bash
agent-browser -p kernel eval "
  const realInputs = Array.from(document.querySelectorAll('input'))
    .filter(el => el.name && el.name.startsWith('xeiinput'));
  // Fill only these inputs
"
```

## Handling Iframes

### Same-Origin Iframes

Use the frame command to switch context:

```bash
agent-browser -p kernel frame "#iframe-id"   # Switch to iframe
agent-browser -p kernel snapshot -i          # Snapshot within iframe
agent-browser -p kernel click @e1            # Interact within iframe
agent-browser -p kernel frame main           # Return to main frame
```

### Cross-Origin Iframes

Cross-origin iframes require executing a Playwright script directly against the Kernel session:

1. Find the session ID:
   ```bash
   kernel browsers list
   ```

2. Execute a Playwright script:
   ```bash
   kernel browsers exec <session-id> --code "
     const frame = page.frameLocator('#payment-iframe');
     await frame.locator('#card-number').fill('4111111111111111');
     await frame.locator('#submit').click();
   "
   ```

See the kernel-cli skill for more details on executing Playwright code.

## Waiting Strategies

Prefer smart waits over fixed timeouts:

```bash
# Wait for network to settle (best for page loads)
agent-browser -p kernel wait --load networkidle

# Wait for specific URL pattern
agent-browser -p kernel wait --url "**/dashboard"

# Wait for text to appear
agent-browser -p kernel wait --text "Success"

# Wait for element
agent-browser -p kernel wait @e1

# Fixed wait (last resort, in milliseconds)
agent-browser -p kernel wait 2000
```

## Element Refs Best Practices

Element refs (`@e1`, `@e2`, etc.) are ephemeral and change:
- After page navigation
- After significant DOM updates
- Between browser sessions

**Always take a fresh snapshot before interacting:**

```bash
agent-browser -p kernel snapshot -i
# Now use the refs from this snapshot
agent-browser -p kernel click @e5
```

### Filtering Snapshots

```bash
# Filter for specific elements
agent-browser -p kernel snapshot -i | grep -i "button\|submit"

# Scope to a specific area
agent-browser -p kernel snapshot -s "#main-content" -i
```

## Login Patterns

### Single-Page Form

Username and password on the same page:

```bash
agent-browser -p kernel open https://example.com/login
agent-browser -p kernel wait 2000
agent-browser -p kernel snapshot -i
agent-browser -p kernel fill @e2 "username"
agent-browser -p kernel fill @e3 "password"
agent-browser -p kernel click @e7   # Submit button
agent-browser -p kernel wait 3000
agent-browser -p kernel get url     # Verify redirect
```

### Two-Step Form

Username first, then password on a second screen:

```bash
agent-browser -p kernel open https://example.com/login
agent-browser -p kernel fill @e1 "username"
agent-browser -p kernel press Enter
agent-browser -p kernel wait 2000
agent-browser -p kernel snapshot -i   # Get new refs for password page
agent-browser -p kernel fill @e3 "password"
agent-browser -p kernel press Enter
agent-browser -p kernel wait 3000
```

### Modal Login

Login form appears in a modal overlay:

```bash
# Click login link to open modal
agent-browser -p kernel eval "document.querySelector('.login-link').click()"
agent-browser -p kernel wait 1000

# Fill modal fields (may require eval if refs don't work)
agent-browser -p kernel eval "
  document.getElementById('username').value = 'user@example.com';
  document.getElementById('password').value = 'password123';
  document.querySelector('button.btn-primary').click();
"
agent-browser -p kernel wait 2000
```

## Handling New Tabs

Some links open in new tabs:

```bash
# Click link that opens new tab
agent-browser -p kernel click @e38
agent-browser -p kernel tab 1           # Switch to new tab (0-indexed)
agent-browser -p kernel wait 2000
agent-browser -p kernel snapshot -i     # Interact with new tab
```

## Screenshots and Debugging

```bash
# Take screenshot
agent-browser -p kernel screenshot ~/Downloads/page.png

# Full page screenshot
agent-browser -p kernel screenshot ~/Downloads/full.png --full

# View console messages
agent-browser -p kernel console

# View page errors
agent-browser -p kernel errors

# Get current URL
agent-browser -p kernel get url
```

## Session Management

### Cleanup

Always close the browser when done to save the profile:

```bash
agent-browser -p kernel close
```

### Multiple Sessions

Run parallel browser sessions with named sessions:

```bash
agent-browser -p kernel --session site1 open https://site1.com
agent-browser -p kernel --session site2 open https://site2.com
agent-browser -p kernel session list
```

## Common Gotchas

1. **Refs change after navigation**: Always re-snapshot after clicking links or submitting forms.

2. **Wait after actions**: Add waits after clicks/submits that trigger page loads or AJAX.

3. **Profile not saving**: Make sure to run `agent-browser -p kernel close` to save the profile state.

4. **Timeout too short**: Increase `KERNEL_TIMEOUT_SECONDS` for workflows with user pauses or slow pages.

5. **Stealth not working**: Some sites detect bots despite stealth. Use manual login fallback.

6. **eval for stubborn elements**: If `fill` or `click` don't work, try `eval` with direct DOM manipulation.

7. **Cross-origin iframes**: Can't interact via agent-browser commands. Use Kernel's Playwright execution.

## Quick Reference

```bash
# Start session with profile persistence
export KERNEL_PROFILE_NAME=mysite
export KERNEL_TIMEOUT_SECONDS=600
agent-browser -p kernel open https://example.com

# Basic interaction loop
agent-browser -p kernel snapshot -i
agent-browser -p kernel fill @eN "text"
agent-browser -p kernel click @eM
agent-browser -p kernel wait --load networkidle

# Get session info for manual intervention
kernel browsers list
kernel browsers view <session-id>

# Cleanup
agent-browser -p kernel close
```
