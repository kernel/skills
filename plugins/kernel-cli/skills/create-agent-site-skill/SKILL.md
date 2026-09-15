---
name: create-agent-site-skill
description: Guide for creating a new site-specific browser automation skill for a website, backed by a Kernel cloud browser and driven by Kernel's own CLI primitives (playwright execute, computer screenshots) by default. Use when asked to build or package a skill for automating a specific website with Kernel, to turn a one-off browser automation into a reusable SKILL.md, or to decide whether a site needs a heavier automation framework (agent-browser, browser-harness) layered on top of Kernel.
---

# Creating Site-Specific Browser Automation Skills

This guide walks through building a new automation skill for a specific website, backed by a Kernel cloud browser. Default to Kernel's own primitives from the `kernel-cli` skill — `playwright execute` and `computer screenshot` — which need no extra dependency. Only load a heavier framework when the site's interaction pattern genuinely calls for it (see "Choosing a Tool" below).

## Prerequisites

Load the `kernel-cli` skill for CLI installation, authentication, and the full command reference used throughout this guide.

## Naming Convention

**Use the website's domain as the skill folder name:**

```
.claude/skills/<domain>/SKILL.md
```

Examples: `kroger.com/`, `amazon.com/`. Use the primary domain where automation occurs.

## Choosing a Tool

Start with raw Kernel primitives: drive the page directly with Playwright's own locator API (`page.getByRole`, `page.getByLabel`, `page.getByText`, CSS/XPath fallback) via `kernel browsers playwright execute`, and confirm state with `kernel browsers computer screenshot`. This covers most sites and keeps the produced skill dependency-free.

Some interactions don't work over the DOM no matter what selector you try — drag-and-drop on pointer-sensor libraries (dnd-kit, SortableJS), canvas/WebGL widgets, or sites that flag CDP-driven input specifically. For those, fall back to `kernel browsers computer` (mouse/keyboard driven by pixel coordinates off a screenshot) for just the step that needs it — see "Computer-Use Fallback" under Key Techniques. [Kernel's docs](https://www.kernel.sh/docs/browsers/playwright-computer-use-fallback) cover the same fallback built as a bounded, model-driven agent loop (`@onkernel/browser-loop`); reach for that instead of this guide's plain CLI recipe if you're building an autonomous tool-calling agent rather than a scripted skill.

Load a heavier framework instead when:

- The site needs many rounds of accessibility-snapshot-and-click across a long interactive session → load the `kernel-agent-browser` skill (attaches `agent-browser` over CDP to a kernel-cli-created browser).
- The task already runs inside a browser-use / `browser-harness`-driven agent, or needs that tool's multi-call daemon session reuse → load the `kernel-browser-harness` skill.

Whichever you pick, name it explicitly in the produced skill's Configuration section — it's a real dependency for whoever runs the skill later, not an implementation detail to leave out.

## Workflow Discovery Process

Do the task for real, against a live Kernel browser, before writing anything down.

### Step 1: Start a Kernel Browser Session

```bash
kernel profiles create --name <site-name>   # once, if you want persistent login
SESSION=$(kernel browsers create --profile-name <site-name> --save-changes --stealth -o json | jq -r '.session_id')
```

`--save-changes` writes cookies and storage back to the profile when the session ends, so a later run can reuse the login. `--stealth` only takes effect at launch — set it now rather than after a failed login shows it was needed.

### Step 2: Explore the Login Flow

Most sites require authentication. Document the login process as you go:

```bash
kernel browsers playwright execute "$SESSION" 'await page.goto("<login-url>")'
kernel browsers computer screenshot "$SESSION" --to /tmp/login.png   # look at it
```

Try filling and submitting, using `return` to get a value back:

```bash
kernel browsers playwright execute "$SESSION" '
  await page.getByLabel("Username").fill("<username>");
  await page.getByLabel("Password").fill("<password>");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
  return page.url();
'
```

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

### Step 4: Explore Each Requested Workflow

For each workflow the user wants:

1. **Navigate** to the relevant section
2. **Screenshot** to see current state
3. **Try locators** — prefer `page.getByRole` / `getByLabel` / `getByText` over raw CSS where the site's semantics allow it; these tend to survive markup changes better than brittle selectors
4. **Confirm** with a `return` (URL, extracted text, element count)
5. **Fall back to computer-use** (see below) if a Playwright action reports success but the page state doesn't actually change after 1-2 attempts — don't keep retrying the same DOM approach
6. **Test** the full workflow end-to-end in one `playwright execute` call
7. **Record** the exact selectors (or coordinates, if computer-use was needed) and waits that worked

### Step 5: Document Findings

For each workflow, record:
- URL patterns (direct links when available)
- The Playwright snippet that performs it
- Wait conditions needed between steps
- Verification checks (how to confirm success)
- Edge cases and error handling

## SKILL.md Template

```markdown
---
name: <descriptive-name>
description: <what the skill does>. Use when <trigger conditions>.
---

# <Site Name>

Uses a Kernel cloud browser driven by `kernel browsers playwright execute`. See the `kernel-cli` skill for CLI installation and the full command reference.

## Configuration

\`\`\`bash
export KERNEL_API_KEY="your-api-key"   # required
\`\`\`

Create the browser with the options this site needs:

\`\`\`bash
kernel profiles create --name <site-name>   # once, to persist login
SESSION=$(kernel browsers create --profile-name <site-name> --save-changes --stealth --timeout 600 -o json | jq -r '.session_id')
\`\`\`

## Login Workflow

\`\`\`bash
kernel browsers playwright execute "$SESSION" '
  await page.goto("<login-url>");
  await page.getByLabel("Username").fill("<username>");
  await page.getByLabel("Password").fill("<password>");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
  return page.url();
'
\`\`\`

If bot detection blocks this, get the live view and ask the user to log in manually: `kernel browsers view "$SESSION" -o json`.

## <Workflow Name>

<The Playwright snippet, URL patterns, and verification for each requested workflow. If a step needed the computer-use fallback, give the coordinates and the viewport size they were recorded at instead of a selector.>

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

Use this to confirm page state instead of relying on element refs — there are none to track here, since every `playwright execute` call takes a fresh page.

### Selectors

Reach for Playwright's own locator API first: `page.getByRole(...)`, `page.getByLabel(...)`, `page.getByText(...)`. Fall back to CSS or `page.locator('xpath=...')` only when the site has no usable semantics. Because each call re-resolves selectors against the live page, there's no ref-invalidation-after-navigation problem to work around.

### Computer-Use Fallback

When a Playwright action reports success but nothing actually happens on the page — the usual symptom on custom drag-and-drop, canvas/WebGL, or CDP-fingerprinting sites — stop retrying the DOM approach and drive that one step by pixel coordinates instead:

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
- Switch back to `playwright execute` for the next step once the fallback step is done; there's no session-level lock like the bounded agent-loop pattern in Kernel's docs — the constraint here is just "don't mix DOM and OS-level actions within the same gesture."

### Handling iframes

Playwright crosses cross-origin iframes natively within a single `playwright execute` call — no separate script or session handoff needed:

```bash
kernel browsers playwright execute "$SESSION" '
  const frame = page.frameLocator("iframe[name=\"payment\"]");
  await frame.getByLabel("Card number").fill("4242424242424242");
'
```

### Waiting Strategies

```javascript
await page.waitForURL("**/dashboard");
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=Success");
await page.waitForTimeout(2000);   // fixed wait, last resort
```

### URL Patterns

Document URL patterns for direct navigation:
```
# Order history
https://www.kroger.com/mypurchases

# Pending orders
https://www.kroger.com/mypurchases/pending/{order_id}
```

## Loading Another Framework

If you decided in "Choosing a Tool" that raw Kernel primitives aren't enough, load the framework's skill and follow its conventions for the automation commands themselves — everything else in this guide (naming, discovery order, credential handling, template shape) stays the same:

- **`kernel-agent-browser`** — snapshot/ref-based interaction via `agent-browser`. Reuse the browser you already created in Step 1 rather than minting a second one: fetch its `cdp_ws_url` with `kernel browsers get "$SESSION" -o json` and attach with `agent-browser --session <name> --cdp "$CDP_URL"` (its own skill documents why — as of agent-browser 0.33.0, `-p kernel` combined with `KERNEL_PROFILE_NAME` returns HTTP 400). Use its "Creating Site-Specific Browser Automation Skills" reference for the login/workflow command shapes, and note the dependency in the produced skill's Configuration section.
- **`kernel-browser-harness`** — drives the browser via `browser-harness`'s `BU_CDP_WS`/`BU_NAME` env vars against a Kernel-minted CDP URL. Use when the task is already running inside a browser-harness-driven agent.

## Credential Management

Prompt the user if they want to store credentials in their agent configuration file (e.g. `AGENTS.md`):

```markdown
### <Site Name>
- **URL**: <login-url>
- **Username**: <username>
- **Password**: <password>
```

Reference credentials from the skill but don't duplicate the actual values in SKILL.md if they're already stored elsewhere.

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

1. **Test each step individually** before combining into one `playwright execute` call
2. **Prefer role/label/text locators** but note where a site forces brittle CSS
3. **Add wait conditions** generously, then trim to what's actually needed
4. **Capture screenshots** of key states for reference
5. **Note failures** — document what doesn't work and the workaround

## Cleanup

Always delete the browser session when done:

```bash
kernel browsers delete "$SESSION"
```

## Example: Creating a New Site Skill

User request: "Create a skill for example.com to check my account balance"

1. **Create skill folder**: `.claude/skills/example.com/`

2. **Start a browser and explore**:
   ```bash
   SESSION=$(kernel browsers create --profile-name example.com --save-changes -o json | jq -r '.session_id')
   kernel browsers playwright execute "$SESSION" 'await page.goto("https://example.com/login")'
   kernel browsers computer screenshot "$SESSION" --to /tmp/example-login.png
   ```

3. **Document the login flow** (selectors, credentials, verification)

4. **Find the account balance page** (navigate, screenshot, document the path and selector)

5. **Write SKILL.md** with:
   - Configuration section
   - Login workflow with the actual Playwright snippet
   - Account balance workflow
   - Notes on any quirks discovered

6. **Ask the user if they want credentials stored**

7. **Test the complete workflow** end-to-end

8. **Commit to git**
