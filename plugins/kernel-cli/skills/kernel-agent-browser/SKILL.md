---
name: kernel-agent-browser
description: Best practices for using agent-browser with Kernel cloud browsers. Use when automating websites with agent-browser -p kernel, tuning stealth or proxy behavior, persisting profiles, handling iframes, discovering Kernel session IDs or live views, or cleaning up cloud sessions.
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
- **Create site-specific automation skills** for new websites

## References

- [Creating Site-Specific Skills](references/create-site-specific-skill.md) - Guide for building automation skills for specific websites

## Prerequisites

Load the `kernel-cli` skill for Kernel CLI installation and authentication.

## Environment Variables

Set these before your first `agent-browser -p kernel` call. The CLI holds state between invocations.

| Variable | Description | Default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **Required.** Your Kernel API key for authentication | (none) |
| `KERNEL_HEADLESS` | Run browser in headless mode (`true`/`false`) | `true` |
| `KERNEL_STEALTH` | Launch a stealth browser (`true`/`false`) | `false` |
| `KERNEL_TIMEOUT_SECONDS` | Session timeout in seconds | `300` |
| `KERNEL_PROFILE_NAME` | Browser profile name for persistent cookies/logins | (none) |

### Recommended Configuration

Set options explicitly; agent-browser reads them when it creates the provider session.

```bash
export KERNEL_API_KEY="your-api-key"
export KERNEL_TIMEOUT_SECONDS=600     # 10-minute timeout for complex workflows
export KERNEL_HEADLESS=false          # Required when you need a live view
export KERNEL_STEALTH=true            # Opt in for bot-sensitive sites
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

## Semantic Selectors (Recommended)

Instead of ephemeral `@e` refs that change on every page load, use **semantic selectors** via the `find` command for more stable, readable automation:

```bash
# By ARIA role + accessible name (most stable)
agent-browser -p kernel find role button click --name "Log In"
agent-browser -p kernel find role textbox fill "user@email.com" --name "Email"

# By visible text content
agent-browser -p kernel find text "View Menus" click
agent-browser -p kernel find text "Submit Order" click

# By form label (great for inputs)
agent-browser -p kernel find label "Username" fill "myuser"
agent-browser -p kernel find label "Password" fill "secret123"

# By placeholder text
agent-browser -p kernel find placeholder "Search..." type "query"

# By data-testid (if the site uses them)
agent-browser -p kernel find testid "submit-btn" click

# By position (when needed)
agent-browser -p kernel find first "li.item" click
agent-browser -p kernel find nth 2 ".card" hover
```

### When to Use Which Selector

| Selector Type | Best For | Stability |
|---------------|----------|-----------|
| `find role --name` | Buttons, links, navigation | ⭐⭐⭐ Most stable |
| `find label` | Form inputs with labels | ⭐⭐⭐ Most stable |
| `find text` | Clickable text elements | ⭐⭐ Stable |
| `find testid` | Sites with test attributes | ⭐⭐⭐ Most stable |
| `find placeholder` | Search boxes, inputs | ⭐⭐ Stable |
| `@e` refs | Unknown sites, quick iteration | ⭐ Ephemeral |

**Recommendation**: Use `find` for production automation. Use `@e` refs for exploration and quick prototyping, then convert to semantic selectors.

## Find the Kernel Session and Live View

Match agent-browser's CDP endpoint to the active Kernel session. Compare the URL without its query string: the CLI and agent-browser can hold different short-lived `jwt` query values for the same session. The endpoint's scheme, host, and path remain stable. This is more reliable than guessing from creation time when several sessions share a profile. This workflow requires `jq`.

```bash
CDP_URL="$(agent-browser -p kernel get cdp-url)"
CDP_ENDPOINT="${CDP_URL%%\?*}"
SESSION_ID="$(
  kernel browsers list --status active --limit 100 -o json |
    jq -r --arg endpoint "$CDP_ENDPOINT" \
      '.[] | select((.cdp_ws_url | split("?")[0]) == $endpoint) | .session_id' |
    head -n 1
)"
test -n "$SESSION_ID"

kernel browsers view "$SESSION_ID"
```

Do not print or share the CDP URL; it grants browser access. Share a live view URL only with the intended user. A headless session has no live view. If you use `--session <name>`, include it on every agent-browser command, including `get cdp-url`.

## Handling Bot Detection

### Stealth and Proxy Routing

Stealth is opt-in in current agent-browser releases. Set `KERNEL_STEALTH=true` before the first command for a session; changing it later does not reconfigure the running browser.

A stealth browser can use Kernel's default stealth proxy. If that proxy causes a site-specific network or reputation failure and direct metro egress is acceptable, change the running session without disabling stealth:

```bash
kernel browsers update "$SESSION_ID" --disable-default-proxy
# Retry the navigation and compare behavior.

# Re-enable the default stealth proxy while continuing the same session.
kernel browsers update "$SESSION_ID" --disable-default-proxy=false
```

Direct egress changes the public IP and can reduce anti-bot protection. Prefer the default proxy unless testing shows it is the problem. For a configured Kernel proxy, use `--proxy-id <proxy-id>`; remove it with `--clear-proxy`.

### Manual Login Fallback

If automated login fails:

1. Resolve `SESSION_ID` using the CDP-matching workflow above.
2. Run `kernel browsers view "$SESSION_ID"` and give the URL only to the intended user.
3. Ask the user to complete login, then continue in the same agent-browser session.
4. Close normally so the authenticated profile is saved.

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

Try `agent-browser frame` first; current releases can switch into iframe context, including many cross-origin frames. If an out-of-process or payment iframe still fails, resolve `SESSION_ID` and use Kernel's Playwright executor:

```bash
kernel browsers playwright execute "$SESSION_ID" '
  const frame = page.frameLocator("#payment-iframe");
  await frame.locator("#card-number").fill("4111111111111111");
  await frame.locator("#submit").click();
'
```

Return to the main document with `agent-browser -p kernel frame main` after frame interactions.

## Waiting Strategies

**Smart waits are critical for fast, reliable automation.** Using condition-based waits instead of fixed timeouts can reduce execution time by 50%+ while improving reliability.

### Smart Waits (Recommended)

```bash
# Wait for page load states
agent-browser -p kernel wait --load domcontentloaded  # DOM ready
agent-browser -p kernel wait --load networkidle       # Network settled

# Wait for specific URL pattern (great for redirects after login)
agent-browser -p kernel wait --url "**/dashboard"
agent-browser -p kernel wait --url "**/order-confirmation"

# Wait for text to appear (great for dynamic content)
agent-browser -p kernel wait --text "Password"        # Field appeared
agent-browser -p kernel wait --text "Order confirmed" # Success message

# Wait for JavaScript condition
agent-browser -p kernel wait --fn "window.appReady === true"
agent-browser -p kernel wait --fn "document.querySelector('.spinner') === null"

# Wait for element by CSS selector
agent-browser -p kernel wait "#login-form"
agent-browser -p kernel wait ".results-loaded"
```

### Fixed Waits (Last Resort)

```bash
# Only when no condition is available
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

### Single-Page Form (Optimized)

Username and password on the same page:

```bash
agent-browser -p kernel open https://example.com/login
agent-browser -p kernel wait --load domcontentloaded

# Use semantic selectors for stability
agent-browser -p kernel find label "Email" fill "user@example.com"
agent-browser -p kernel find label "Password" fill "secret123"
agent-browser -p kernel find role button click --name "Sign In"

# Wait for actual redirect, not arbitrary timeout
agent-browser -p kernel wait --url "**/dashboard"
```

### Two-Step Form (Optimized)

Username first, then password on a second screen:

```bash
agent-browser -p kernel open https://example.com/login
agent-browser -p kernel wait --load domcontentloaded

# Step 1: Username
agent-browser -p kernel find label "Username" fill "myuser"
agent-browser -p kernel press Enter

# Wait for password field to appear (not a fixed sleep!)
agent-browser -p kernel wait --text "Password"

# Step 2: Password
agent-browser -p kernel find label "Password" fill "secret123"
agent-browser -p kernel press Enter

# Wait for successful redirect
agent-browser -p kernel wait --url "**/home"
```

### Modal Login

Login form appears in a modal overlay:

```bash
# Click login link to open modal
agent-browser -p kernel find text "Log In" click
agent-browser -p kernel wait --text "Password"  # Wait for modal

# Fill modal fields
agent-browser -p kernel find label "Email" fill "user@example.com"
agent-browser -p kernel find label "Password" fill "password123"
agent-browser -p kernel find role button click --name "Sign In"
agent-browser -p kernel wait --url "**/dashboard"
```

### Fallback: JavaScript for Tricky Modals

Some modals don't expose accessible labels:

```bash
agent-browser -p kernel eval "document.querySelector('.login-link').click()"
agent-browser -p kernel wait 1000

agent-browser -p kernel eval "
  document.getElementById('username').value = 'user@example.com';
  document.getElementById('username').dispatchEvent(new Event('input', {bubbles: true}));
  document.getElementById('password').value = 'password123';
  document.getElementById('password').dispatchEvent(new Event('input', {bubbles: true}));
  document.querySelector('button[type=submit]').click();
"
agent-browser -p kernel wait --url "**/dashboard"
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

Close the same named agent-browser session you opened. This saves profile changes and deletes its Kernel browser:

```bash
agent-browser -p kernel close
# Named session: agent-browser -p kernel --session site1 close
```

If agent-browser is unavailable or close fails, delete the orphan explicitly:

```bash
kernel browsers delete "$SESSION_ID"
```

Do not use `close --all` when unrelated agent-browser sessions may be running.

### Multiple Sessions

Run parallel browser sessions with named sessions:

```bash
agent-browser -p kernel --session site1 open https://site1.com
agent-browser -p kernel --session site2 open https://site2.com
agent-browser -p kernel session list
```

## Common Gotchas

1. **Refs change after navigation**: Re-snapshot after links, submissions, or major DOM updates.
2. **Wait for outcomes**: Use URL, text, load-state, or JavaScript conditions after asynchronous actions.
3. **Provider settings are launch-time settings**: Close the current session before changing `KERNEL_HEADLESS`, `KERNEL_STEALTH`, timeout, or profile.
4. **Profiles need normal cleanup**: Run `close`; use `kernel browsers delete` only as the orphan fallback.
5. **Stealth is not sufficient for every site**: Compare proxy routing, use manual login, or fall back to direct Playwright for difficult frames.

## Quick Reference

```bash
# Start session with profile persistence
export KERNEL_PROFILE_NAME=mysite
export KERNEL_TIMEOUT_SECONDS=600
agent-browser -p kernel open https://example.com

# Basic interaction with semantic selectors (recommended)
agent-browser -p kernel wait --load domcontentloaded
agent-browser -p kernel find label "Email" fill "user@example.com"
agent-browser -p kernel find label "Password" fill "secret"
agent-browser -p kernel find role button click --name "Submit"
agent-browser -p kernel wait --url "**/success"

# Alternative: snapshot + refs (for exploration)
agent-browser -p kernel snapshot -i
agent-browser -p kernel fill @eN "text"
agent-browser -p kernel click @eM

# Resolve the underlying session before manual intervention
CDP_URL="$(agent-browser -p kernel get cdp-url)"
CDP_ENDPOINT="${CDP_URL%%\?*}"
SESSION_ID="$(kernel browsers list --status active --limit 100 -o json |
  jq -r --arg endpoint "$CDP_ENDPOINT" \
    '.[] | select((.cdp_ws_url | split("?")[0]) == $endpoint) | .session_id' |
  head -n 1)"
test -n "$SESSION_ID"
kernel browsers view "$SESSION_ID"

# Cleanup (delete by ID only if close fails)
agent-browser -p kernel close
```

### Selector Cheat Sheet

```bash
# Buttons and links
agent-browser -p kernel find role button click --name "Submit"
agent-browser -p kernel find role link click --name "Next"
agent-browser -p kernel find text "Click here" click

# Form inputs
agent-browser -p kernel find label "Email" fill "user@example.com"
agent-browser -p kernel find placeholder "Search" type "query"
agent-browser -p kernel find testid "username-input" fill "myuser"

# Smart waits
agent-browser -p kernel wait --load domcontentloaded
agent-browser -p kernel wait --text "Success"
agent-browser -p kernel wait --url "**/dashboard"
agent-browser -p kernel wait --fn "window.loaded === true"
```
