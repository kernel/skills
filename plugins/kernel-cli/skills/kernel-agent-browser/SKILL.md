---
name: kernel-agent-browser
description: best practices for using agent-browser with KERNEL cloud browsers. use when automating websites with agent-browser -p kernel, tuning stealth or proxy behavior, persisting profiles, handling iframes, discovering KERNEL session ids or live views, or cleaning up cloud sessions.
---

# agent-browser with KERNEL cloud browsers

this skill documents best practices for using agent-browser's built-in KERNEL provider (`-p kernel`) for cloud browser automation.

## when to use this skill

use this skill when you need to:

- **automate websites** using `agent-browser -p kernel` commands
- **handle bot detection** on sites with aggressive anti-bot measures
- **persist login sessions** across automation runs using profiles
- **work with iframes** including cross-origin payment forms
- **get live view urls** for debugging or manual intervention
- **find the underlying KERNEL session id** for advanced Playwright scripting
- **create site-specific automation skills** for new websites

## references

- [creating site-specific skills](references/create-site-specific-skill.md) - guide for building automation skills for specific websites

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## environment variables

set these before your first `agent-browser -p kernel` call. the cli holds state between invocations.

| variable | description | default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **required.** your KERNEL api key for authentication | (none) |
| `KERNEL_HEADLESS` | run browser in headless mode (`true`/`false`) | `true` |
| `KERNEL_STEALTH` | launch a stealth browser (`true`/`false`) | `false` |
| `KERNEL_TIMEOUT_SECONDS` | session timeout in seconds | `300` |
| `KERNEL_PROFILE_NAME` | currently unusable with `-p kernel` in agent-browser 0.33.0; use the cdp workaround below | (none) |

### recommended configuration

set options explicitly; agent-browser reads them when it creates the provider session.

```bash
export KERNEL_API_KEY="your-api-key"
export KERNEL_TIMEOUT_SECONDS=600     # 10-minute timeout for complex workflows
export KERNEL_HEADLESS=false          # Required when you need a live view
export KERNEL_STEALTH=true            # Opt in for bot-sensitive sites
# Do not set KERNEL_PROFILE_NAME with -p kernel; use the workaround below.
```

### profile persistence

> **warning:** `KERNEL_PROFILE_NAME` doesn't work with `-p kernel` in agent-browser 0.33.0. it sends `profile` as a string instead of the object required by KERNEL, so session creation fails with http 400. it also doesn't set `save_changes`. profiles must be pre-created.

until this is fixed upstream, create the browser with the KERNEL cli and attach agent-browser over cdp. don't combine `-p kernel` with `--cdp`.

```bash
PROFILE_NAME=mysite  # Create once with: kernel profiles create --name mysite
kernel profiles get "$PROFILE_NAME" >/dev/null
BROWSER=$(kernel browsers create --profile-name "$PROFILE_NAME" --save-changes --timeout 600 -o json)
SESSION_ID=$(jq -er '.session_id' <<<"$BROWSER")
CDP_URL=$(jq -er '.cdp_ws_url' <<<"$BROWSER")
trap 'kernel browsers delete "$SESSION_ID" >/dev/null 2>&1 || true' EXIT

agent-browser --session mysite --cdp "$CDP_URL" open https://example.com
agent-browser --session mysite snapshot -i
# Run additional commands with --session mysite, then disconnect and end the Kernel session.
agent-browser --session mysite close
kernel browsers delete "$SESSION_ID"
trap - EXIT
```

don't print or share `CDP_URL`; it grants browser access. deleting the cli-created session finalizes `--save-changes`, so later sessions can reuse the authenticated profile.

## basic usage

```bash
agent-browser -p kernel open <url>        # Navigate to page
agent-browser -p kernel snapshot -i       # Get interactive elements with refs
agent-browser -p kernel click @e1         # Click element by ref
agent-browser -p kernel fill @e2 "text"   # Fill input by ref
agent-browser -p kernel close             # Close the provider session
```

for provider-managed sessions, use `-p kernel` with each command. for the profile/cdp workaround, reuse the same `--session` name and don't add `-p kernel`.

## semantic selectors (recommended)

instead of ephemeral `@e` refs that change on every page load, use **semantic selectors** via the `find` command for more stable, readable automation:

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

### when to use which selector

| selector type | best for | stability |
|---------------|----------|-----------|
| `find role --name` | buttons, links, navigation | ⭐⭐⭐ most stable |
| `find label` | form inputs with labels | ⭐⭐⭐ most stable |
| `find text` | clickable text elements | ⭐⭐ stable |
| `find testid` | sites with test attributes | ⭐⭐⭐ most stable |
| `find placeholder` | search boxes, inputs | ⭐⭐ stable |
| `@e` refs | unknown sites, quick iteration | ⭐ ephemeral |

**recommendation**: use `find` for production automation. use `@e` refs for exploration and quick prototyping, then convert to semantic selectors.

## find the KERNEL session and live view

match agent-browser's cdp endpoint to the active KERNEL session. compare the url without its query string: the cli and agent-browser can hold different short-lived `jwt` query values for the same session. the endpoint's scheme, host, and path remain stable. this is more reliable than guessing from creation time when several sessions share a profile. this workflow requires `jq`.

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

do not print or share the cdp url; it grants browser access. share a live view url only with the intended user. a headless session has no live view. if you use `--session <name>`, include it on every agent-browser command, including `get cdp-url`.

## handling bot detection

### stealth and proxy routing

stealth is opt-in in current agent-browser releases. set `KERNEL_STEALTH=true` before the first command for a session; changing it later does not reconfigure the running browser.

a stealth browser can use KERNEL's default stealth proxy. if that proxy causes a site-specific network or reputation failure and direct metro egress is acceptable, change the running session without disabling stealth:

```bash
kernel browsers update "$SESSION_ID" --disable-default-proxy
# Retry the navigation and compare behavior.

# Re-enable the default stealth proxy while continuing the same session.
kernel browsers update "$SESSION_ID" --disable-default-proxy=false
```

direct egress changes the public ip and can reduce anti-bot protection. prefer the default proxy unless testing shows it is the problem. for a configured KERNEL proxy, use `--proxy-id <proxy-id>`; remove it with `--clear-proxy`.

### manual login fallback

if automated login fails:

1. resolve `SESSION_ID` using the cdp-matching workflow above.
2. run `kernel browsers view "$SESSION_ID"` and give the url only to the intended user.
3. ask the user to complete login, then continue in the same agent-browser session.
4. to persist the login, use the cli-created profile/cdp workflow above. close agent-browser, then delete the KERNEL session so `--save-changes` finalizes.

### JavaScript fallback for tricky elements

some elements (especially on bot-protected sites) don't respond to standard commands:

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

### anti-bot form fields

some payment processors (e.g., Point and Pay) use decoy form fields. only fill fields matching specific patterns:

```bash
agent-browser -p kernel eval "
  const realInputs = Array.from(document.querySelectorAll('input'))
    .filter(el => el.name && el.name.startsWith('xeiinput'));
  // Fill only these inputs
"
```

## handling iframes

### same-origin iframes

use the frame command to switch context:

```bash
agent-browser -p kernel frame "#iframe-id"   # Switch to iframe
agent-browser -p kernel snapshot -i          # Snapshot within iframe
agent-browser -p kernel click @e1            # Interact within iframe
agent-browser -p kernel frame main           # Return to main frame
```

### cross-origin iframes

try `agent-browser frame` first; current releases can switch into iframe context, including many cross-origin frames. if an out-of-process or payment iframe still fails, resolve `SESSION_ID` and use KERNEL's Playwright executor:

```bash
kernel browsers playwright execute "$SESSION_ID" '
  const frame = page.frameLocator("#payment-iframe");
  await frame.locator("#card-number").fill("4111111111111111");
  await frame.locator("#submit").click();
'
```

return to the main document with `agent-browser -p kernel frame main` after frame interactions.

## waiting strategies

**smart waits are critical for fast, reliable automation.** using condition-based waits instead of fixed timeouts can reduce execution time by 50%+ while improving reliability.

### smart waits (recommended)

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

### fixed waits (last resort)

```bash
# Only when no condition is available
agent-browser -p kernel wait 2000
```

## element refs best practices

element refs (`@e1`, `@e2`, etc.) are ephemeral and change:
- after page navigation
- after significant dom updates
- between browser sessions

**always take a fresh snapshot before interacting:**

```bash
agent-browser -p kernel snapshot -i
# Now use the refs from this snapshot
agent-browser -p kernel click @e5
```

### filtering snapshots

```bash
# Filter for specific elements
agent-browser -p kernel snapshot -i | grep -i "button\|submit"

# Scope to a specific area
agent-browser -p kernel snapshot -s "#main-content" -i
```

## login patterns

### single-page form (optimized)

username and password on the same page:

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

### two-step form (optimized)

username first, then password on a second screen:

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

### modal login

login form appears in a modal overlay:

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

### fallback: JavaScript for tricky modals

some modals don't expose accessible labels:

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

## handling new tabs

some links open in new tabs:

```bash
# Click link that opens new tab
agent-browser -p kernel click @e38
agent-browser -p kernel tab 1           # Switch to new tab (0-indexed)
agent-browser -p kernel wait 2000
agent-browser -p kernel snapshot -i     # Interact with new tab
```

## screenshots and debugging

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

## session management

### cleanup

close the same named agent-browser session you opened. this saves profile changes and deletes its KERNEL browser:

```bash
agent-browser -p kernel close
# Named session: agent-browser -p kernel --session site1 close
```

if agent-browser is unavailable or close fails, delete the orphan explicitly:

```bash
kernel browsers delete "$SESSION_ID"
```

do not use `close --all` when unrelated agent-browser sessions may be running.

### multiple sessions

run parallel browser sessions with named sessions:

```bash
agent-browser -p kernel --session site1 open https://site1.com
agent-browser -p kernel --session site2 open https://site2.com
agent-browser -p kernel session list
```

## common gotchas

1. **refs change after navigation**: re-snapshot after links, submissions, or major dom updates.
2. **wait for outcomes**: use url, text, load-state, or JavaScript conditions after asynchronous actions.
3. **provider settings are launch-time settings**: close the current session before changing `KERNEL_HEADLESS`, `KERNEL_STEALTH`, or timeout.
4. **profile persistence needs the cdp workaround**: `KERNEL_PROFILE_NAME` is currently broken. close agent-browser, then delete the cli-created KERNEL session to finalize `--save-changes`.
5. **stealth is not sufficient for every site**: compare proxy routing, use manual login, or fall back to direct Playwright for difficult frames.

## quick reference

```bash
# Start a standard provider session (for persistence, use the CDP workflow above)
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

### selector cheat sheet

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
