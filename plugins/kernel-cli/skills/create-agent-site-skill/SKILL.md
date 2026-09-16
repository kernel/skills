---
name: create-agent-site-skill
description: Guide for creating a new site-specific browser automation skill for a website, backed by a Kernel cloud browser and driven by Kernel's own CLI primitives (playwright execute, computer screenshots) by default. Use when asked to build or package a skill for automating a specific website with Kernel, to turn a one-off browser automation into a reusable SKILL.md, or to decide whether to build the skill around Kernel's own primitives or the customer's preferred agent harness (agent-browser, browser-harness, or another custom harness).
---

# Creating Site-Specific Browser Automation Skills

This guide walks through building a new automation skill for a specific website, backed by a Kernel cloud browser. Default to Kernel's own primitives from the `kernel-cli` skill — `playwright execute` and `computer screenshot` — which need no extra dependency. Only reach for the customer's own primitives when they already have a preferred way to drive browsers (see "Choosing Other Primitives" at the end).

## Prerequisites

Load the `kernel-cli` skill for CLI installation, authentication, and the full command reference used throughout this guide.

This skill requires a headful (non-headless) session — Kernel's default — since the computer-use fallback below needs a GUI environment. Don't add `--headless` when creating the browser.

## Naming Convention

Use the website's domain as the skill folder name inside the target agent's registered skill directory:

```
<skills-directory>/<domain>/SKILL.md
```

Examples: `<skills-directory>/kroger.com/SKILL.md`, `<skills-directory>/amazon.com/SKILL.md`. Resolve `<skills-directory>` from the target environment's skill-management instructions rather than assuming a particular agent. Use the primary domain where automation occurs.

The skill file itself is per-site and shared across whoever runs it. The vault it uses for login (see Step 1/2) is per-user — the skill resolves `<user-id>` from whatever identifies the calling user at runtime (a passed-in parameter, session context, etc.), not a value baked into the skill file, so each user's credentials for the site stay in their own vault.

## Workflow Discovery Process

Do the task for real, against a live Kernel browser, before writing anything down. The steps below use Kernel's own primitives — that's the default unless the customer's prompt names another harness or set of primitives to control the browser with (see "Choosing Other Primitives" at the end).

### Step 1: Start a Kernel Browser Session

```bash
PROFILE_NAME="<site-name>-<user-id>"
kernel profiles get "$PROFILE_NAME" -o json >/dev/null 2>&1 || \
  kernel profiles create --name "$PROFILE_NAME"   # create once per user, then reuse it
VAULT_NAME="<site-name>-<user-id>"
kernel vaults create --name "$VAULT_NAME"   # once per user, if the site needs login — see Step 2
SESSION=$(kernel browsers create --profile-name "$PROFILE_NAME" --save-changes --stealth --vault "$VAULT_NAME" --timeout 600 -o json | jq -r '.session_id')
```

`--save-changes` writes cookies and storage back to the profile when the session ends, so a later run can reuse the login. The profile has to be per-user too, not just the vault — it's what actually holds the authenticated session, so sharing one profile across users would leak one user's login to the next. `--stealth` only takes effect at launch — set it now rather than after a failed login shows it was needed. `--vault` attaches at create time too and can't be added later, so create the vault first if the site needs login, even before you've explored the login form. `--timeout 600` avoids hitting the CLI's 60s default mid-exploration, since discovery spans many steps.

### Step 2: Explore the Login Flow

Most sites require authentication. Default to vault-backed credentials — never ask the user for raw credentials or fill them in yourself. Define the credential's fields without values, which returns a private collection URL for the human to fill in:

```bash
kernel vaults credentials create "$VAULT_NAME" <site-name>-login --spec-file - <<'JSON'
{
  "description": "<Site Name>",
  "fields": {
    "username": {"type": "text", "required": true, "sensitive": false},
    "password": {"type": "password", "required": true, "sensitive": true}
  }
}
JSON
```

Share the returned collection URL with the user directly — never open it yourself in the agent-controlled browser. While they fill it in, find the field selectors:

```bash
kernel browsers playwright execute "$SESSION" 'await page.goto("<login-url>")'
kernel browsers computer screenshot "$SESSION" --to /tmp/login.png   # look at it
```

Once the item is ready, fill the form by field name and selector — the agent never sees the actual username or password — then submit with plain Playwright:

```bash
kernel vaults items get "$VAULT_NAME" <site-name>-login --wait 60 -o json   # confirm status is "ready" and fill is available

kernel vaults items invoke "$VAULT_NAME" <site-name>-login fill --spec-file - <<JSON
{
  "browser_id": "$SESSION",
  "page_url": "<login-url>",
  "fields": [
    {"field": "username", "selector": "input[name='username']"},
    {"field": "password", "selector": "input[name='password']"}
  ]
}
JSON

kernel browsers playwright execute "$SESSION" -o json '
  await Promise.all([
    page.waitForURL("<logged-in-url-pattern>", { timeout: 5000 }),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  return page.url();
'
```

If the fill reports anything other than `"completed"`, stop and reconcile rather than retrying blind — see Credential Management for the full rules.

**Common login patterns:**
- **Single-page form**: username and password on the same page (e.g. Kroger)
- **Two-step form**: username first, then password (e.g. Veracross)
- **OAuth redirect**: site redirects to an identity provider

If the site has aggressive bot detection or the login page behaves strangely and the session wasn't started with `--stealth`, don't debug further on the current session — `--stealth` only takes effect at launch. Delete it, recreate with `--stealth` added, and retry the login from Step 2. If it's still blocked (or was already running with `--stealth`), fall back to a human: fetch the live view URL and ask the user to complete login manually.

```bash
kernel browsers view "$SESSION" -o json   # browser_live_view_url
```

### Step 3: Verify Login Success

Check the returned URL or page content against the expected logged-in state.

### Step 4: Explore Each Requested Task Sequence

Treat each requested workflow as an independently runnable task sequence. Share setup and login prerequisites where useful, but don't make callers run unrelated sequences for a single task. For each task sequence:

1. **Navigate** to the relevant section
2. **Screenshot** to see current state
3. **Try locators** — prefer `page.getByRole` / `getByLabel` / `getByText` over raw CSS where the site's semantics allow it; these tend to survive markup changes better than brittle selectors
4. **Confirm** with a `return` (URL, extracted text, element count) — add `-o json` when the returned value needs parsing, since the default text output pretty-prints long strings across multiple lines
5. **Fall back to computer-use** (see below) if Playwright can't complete the step after 2-3 attempts — whether it errors outright or reports success without the page state actually changing — don't keep retrying the same DOM approach
6. **Test** the complete task sequence end-to-end using the same ordered mix of Playwright and computer-use commands that the produced skill will document
7. **Record** the exact selectors (or coordinates, if computer-use was needed) and waits that worked

### Step 5: Document Findings

For each task sequence, record:
- Required inputs and starting state
- URL patterns (direct links when available)
- The ordered Playwright and computer-use commands that perform it
- Coordinates and viewport size, if a step needed computer-use
- Wait conditions needed between steps
- Verification checks (how to confirm success)
- Edge cases and error handling

## SKILL.md Template

This assumes Kernel's own primitives; if "Choosing Other Primitives" applies, swap the Configuration, Login Workflow, and Cleanup blocks for that harness's commands instead.

```markdown
---
name: <descriptive-name>
description: <what the skill does>. Use when <trigger conditions>.
---

# <Site Name>

Uses a Kernel cloud browser driven by `kernel browsers playwright execute`, with login credentials handled by a Kernel vault. See the `kernel-cli` skill for CLI installation and the full command reference.

## Configuration

\`\`\`bash
export KERNEL_API_KEY="your-api-key"   # required
\`\`\`

Create the vault and browser with the options this site needs:

\`\`\`bash
PROFILE_NAME="<site-name>-<user-id>"
kernel profiles get "$PROFILE_NAME" -o json >/dev/null 2>&1 || \
  kernel profiles create --name "$PROFILE_NAME"   # create once per user, then reuse it
VAULT_NAME="<site-name>-<user-id>"
kernel vaults create --name "$VAULT_NAME"   # once per user, if not already created
SESSION=$(kernel browsers create --profile-name "$PROFILE_NAME" --save-changes --stealth --vault "$VAULT_NAME" --timeout 600 -o json | jq -r '.session_id')
\`\`\`

## Login Workflow

\`\`\`bash
# First time for this user, the vault has no credential item yet — define it, which returns a
# collection URL. Share that with the user and wait for them to fill it in before continuing.
kernel vaults items get "$VAULT_NAME" <site-name>-login -o json || kernel vaults credentials create "$VAULT_NAME" <site-name>-login --spec-file - <<'JSON'
{
  "description": "<Site Name>",
  "fields": {
    "username": {"type": "text", "required": true, "sensitive": false},
    "password": {"type": "password", "required": true, "sensitive": true}
  }
}
JSON

kernel browsers playwright execute "$SESSION" 'await page.goto("<login-url>")'

kernel vaults items get "$VAULT_NAME" <site-name>-login --wait 60 -o json   # confirm status is "ready" and fill is available

kernel vaults items invoke "$VAULT_NAME" <site-name>-login fill --spec-file - <<JSON
{
  "browser_id": "$SESSION",
  "page_url": "<login-url>",
  "fields": [
    {"field": "username", "selector": "input[name='username']"},
    {"field": "password", "selector": "input[name='password']"}
  ]
}
JSON

kernel browsers playwright execute "$SESSION" -o json '
  await Promise.all([
    page.waitForURL("<logged-in-url-pattern>", { timeout: 5000 }),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  return page.url();
'
\`\`\`

If bot detection blocks this, get the live view and ask the user to log in manually: `kernel browsers view "$SESSION" -o json`.

## <Task Sequence Name>

<The required inputs and starting state, ordered Playwright and computer-use commands, URL patterns, and outcome verification for this task sequence. If a step needed the computer-use fallback, give the coordinates and the viewport size they were recorded at instead of a selector. Keep this sequence independently runnable so callers don't need to execute unrelated tasks.>

## Cleanup

\`\`\`bash
kernel browsers delete "$SESSION"
\`\`\`

## Notes

<Quirks, gotchas, and special handling discovered while exploring>
```

## Key Techniques

### Screenshots

```bash
kernel browsers computer screenshot "$SESSION" --to /tmp/state.png
```

Use this to confirm page state instead of relying on element refs — there are none to track here, since each `playwright execute` call is a fresh script context with no carried-over variables or element handles. The underlying page itself isn't reset: the same tab, URL, and DOM persist across calls in a session, so you don't need to re-navigate just because it's a new call.

### Selectors

Reach for Playwright's own locator API first: `page.getByRole(...)`, `page.getByLabel(...)`, `page.getByText(...)`. Fall back to CSS or `page.locator('xpath=...')` only when the site has no usable semantics. Because each call re-resolves selectors against the live page, there's no ref-invalidation-after-navigation problem to work around.

### Computer-Use Fallback

When Playwright can't complete a step after a few attempts — it errors or times out finding a selector, or it reports success but nothing actually happens on the page (the usual symptom on custom drag-and-drop, canvas/WebGL, or CDP-fingerprinting sites) — stop retrying the DOM approach and drive that one step by pixel coordinates instead:

```bash
kernel browsers computer screenshot "$SESSION" --to /tmp/state.png   # read coordinates off this
kernel browsers computer drag-mouse "$SESSION" --point 100,200 --point 250,200 --point 400,200 --button left
kernel browsers computer click-mouse "$SESSION" --x 250 --y 60
kernel browsers computer type "$SESSION" --text "some text"
kernel browsers computer press-key "$SESSION" --key Return
```

Notes:
- Requires a headful session — this is `kernel browsers create`'s default, so this works as long as the workflow didn't add `--headless`.
- A drag needs waypoints between the two `--point` values, not just the endpoints, or the page's pointer-sensor library won't register movement.
- Coordinates are screenshot-pixel-space and specific to the viewport size the session was created with — record that alongside the coordinates in the produced skill's Notes section.
- Switch back to `playwright execute` for the next step once the fallback step is done — the only constraint is "don't mix DOM and OS-level actions within the same gesture."

### Handling iframes

Playwright crosses cross-origin iframes natively within a single `playwright execute` call — no separate script or session handoff needed:

```bash
kernel browsers playwright execute "$SESSION" '
  const frame = page.frameLocator("iframe[name=\"payment\"]");
  await frame.getByLabel("Card number").fill("4242424242424242");
'
```

### Waiting Strategies

Wait for the observable condition that proves an asynchronous step completed — such as a URL change, visible state, completed response, or extracted value — using the selected browser primitive. Don't use `networkidle` as a default success condition: ads, analytics, and long-lived connections can prevent otherwise-complete pages from reaching it.

With the default Playwright primitive, set explicit, short timeouts on those conditions rather than relying on Playwright's 30-second default:

```bash
kernel browsers playwright execute "$SESSION" '
  await page.waitForURL("**/dashboard", { timeout: 5000 });
  await page.getByText("Success", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
  await Promise.all([
    page.waitForResponse(response => response.url().includes("/api/orders") && response.ok(), { timeout: 5000 }),
    page.getByRole("button", { name: "Refresh orders" }).click()
  ]);
  await page.waitForTimeout(2000);   // fixed wait, last resort
'
```

### URL Patterns

Document URL patterns for direct navigation:
```
# Order history
https://www.kroger.com/mypurchases

# Pending orders
https://www.kroger.com/mypurchases/pending/{order_id}
```

## Credential Management

Don't ask the user for raw credentials or store them in `AGENTS.md`. Every login flow in this guide (Step 1/2, the SKILL.md Template, the Example) is vault-first by default: create a vault, attach it to the browser at creation time, define the credential's fields without ever holding the values yourself, and let the human fill them in through a private link. The agent fills the login form by field name and CSS selector — it never sees the actual username or password.

Rules that apply everywhere the guide uses a vault:
- The vault is per-user, not per-site — the skill file is shared, but each user gets their own vault (`<site-name>-<user-id>`) so their credentials never mix with another user's. The browser profile has to be scoped the same way: a shared profile persists whichever user's cookies were saved last, which would leak one user's authenticated session to the next.
- The vault attachment happens at `browsers create` time and can't be added later — decide up front whether the site needs one.
- Keep the vault and the browser in the same Kernel project.
- Share the collection URL with the user directly; never open it yourself in the agent-controlled browser.
- Never read, print, screenshot, or return the filled values.
- If a fill errors, comes back with an unexpected status, or times out, stop and reconcile rather than retrying blind.

## Common Patterns by Site Type

### E-commerce Sites (Kroger, Amazon)
- Login → Account menu → Order history
- Search → Product page → Add to cart
- Cart → Checkout flow
- Pending orders / order modification

### Portal/Dashboard Sites (Veracross, YNAB)
- Login (often OAuth-based)
- Navigation sidebar/menu
- Data tables with pagination
- Modal dialogs for details

### Bill Payment Sites
- Login (may use a modal)
- Invoice/amount form
- Stored payment methods
- Confirmation/receipt capture

## Testing and Iteration

1. **Test each step individually** before running the complete task sequence end-to-end
2. **Prefer role/label/text locators** but note where a site forces brittle CSS
3. **Add an explicit wait when the next step depends on an asynchronous transition** — wait for the URL, visible state, response, or extracted value that discovery showed proves completion
4. **Capture screenshots** of key states for reference
5. **Note failures** — document what doesn't work and the workaround

## Cleanup

Always delete the browser session when done:

```bash
kernel browsers delete "$SESSION"
```

## Example: Creating a New Site Skill

User request: "Create a skill for example.com to check my account balance"

1. **Create the site skill folder**: `<skills-directory>/example.com/`, using the target agent's registered skill directory

2. **Start a browser and explore**:
   ```bash
   PROFILE_NAME="example.com-<user-id>"
   kernel profiles get "$PROFILE_NAME" -o json >/dev/null 2>&1 || \
     kernel profiles create --name "$PROFILE_NAME"
   VAULT_NAME="example.com-<user-id>"
   kernel vaults create --name "$VAULT_NAME"
   SESSION=$(kernel browsers create --profile-name "$PROFILE_NAME" --save-changes --stealth --vault "$VAULT_NAME" --timeout 600 -o json | jq -r '.session_id')
   kernel browsers playwright execute "$SESSION" 'await page.goto("https://example.com/login")'
   kernel browsers computer screenshot "$SESSION" --to /tmp/example-login.png
   ```

3. **Document the login flow** using the vault-backed credential flow from Step 2 (selectors, verification)

4. **Build the account balance task sequence** (navigate, screenshot, document its inputs, ordered commands, and verification)

5. **Write SKILL.md** with:
   - Configuration section
   - Login workflow with the vault fill invocation and the actual selectors
   - Independently runnable account balance task sequence
   - Notes on any quirks discovered

6. **Share the vault collection URL** with the user so they can fill in their credentials

7. **Test the complete account balance task sequence** end-to-end

8. **Commit to git**

## Choosing Other Primitives

Everything above defaults to Kernel's own primitives — `kernel browsers playwright execute` and `kernel browsers computer`. If the customer already drives browsers through their own agent harness or a set of user-provided primitives, build the produced skill around those instead — the goal is to match how the calling agent already talks to browsers, not to force Kernel's shape onto it. Load the framework's skill and follow its conventions for the automation commands themselves; everything else in this guide (naming, discovery order, credential handling, template shape) stays the same:

- **`agent-browser`'s snapshot/ref model** → load the `kernel-agent-browser` skill. Reuse the browser you already created in Step 1 rather than minting a second one: fetch its `cdp_ws_url` with `kernel browsers get "$SESSION" -o json` and attach with `agent-browser --session <name> --cdp "$CDP_URL"` (its own skill documents why — as of agent-browser 0.33.0, `-p kernel` combined with `KERNEL_PROFILE_NAME` returns HTTP 400). Use its "Creating Site-Specific Browser Automation Skills" reference for the login/workflow command shapes.
- **`browser-harness`'s `BU_CDP_WS`/`BU_NAME` model** → load the `kernel-browser-harness` skill. Use when the task is already running inside a browser-harness-driven agent.
- **Anything else** → mint the browser with `kernel browsers create` and hand its `cdp_ws_url` straight to that harness; Kernel only needs to supply the browser, not drive it.

Whichever primitives you land on, name them explicitly in the produced skill's Configuration section — it's a real dependency for whoever runs the skill later, not an implementation detail to leave out.
