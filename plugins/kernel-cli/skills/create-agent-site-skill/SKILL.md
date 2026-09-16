---
name: create-agent-site-skill
description: Create reusable skills for automating specific websites with Kernel cloud browsers. Use when building a new site skill or turning an existing browser workflow into one.
---

# Create Site-Specific Browser Skills

Capture working browser workflows as independently runnable tasks in a reusable skill. Reuse existing verified workflows; explore missing steps in a live browser within the user's authorized scope.

## Choose Browser Controls

Default to `kernel browsers playwright execute` and `kernel browsers computer`. Load [kernel-cli](../kernel-cli/SKILL.md) for installation, authentication, and command syntax.

If the caller specifies another harness, use its commands and record that dependency in the generated skill:

- **agent-browser:** Load [kernel-agent-browser](../kernel-agent-browser/SKILL.md) and follow its CDP attachment workflow, reusing the browser created below.
- **browser-harness:** Load [kernel-browser-harness](../kernel-browser-harness/SKILL.md) when the calling agent uses its `BU_CDP_WS`/`BU_NAME` model.
- **Other harnesses:** Pass the Kernel browser's `cdp_ws_url` to the selected harness.

Adapt the command examples below to the selected controls; retain the session and credential requirements.

## Discover the Workflows

### 1. Prepare a Browser

Keep profiles and vaults scoped to both site and user: `<site-name>-<user-id>`. Resolve the user ID from runtime input or session context; never hard-code it in the shared skill. Profiles contain authenticated cookies as well as storage.

For a site requiring login, create the profile and vault once, then reuse them. Keep both in the same Kernel project as the browser. Run the creation commands only for resources confirmed absent:

```bash
PROFILE_NAME="<site-name>-<user-id>"
VAULT_NAME="<site-name>-<user-id>"

# First-time setup only:
kernel profiles create --name "$PROFILE_NAME"
kernel vaults create --name "$VAULT_NAME"

# Each run:
SESSION=$(kernel browsers create --profile-name "$PROFILE_NAME" --save-changes --stealth --vault "$VAULT_NAME" --timeout 600 -o json | jq -r '.session_id')
```

- Use a headful session (the default); computer-use and live view require it.
- Set `--stealth` and attach the vault at creation time; neither can be added later. Omit vault setup and `--vault` for sites that do not need login.
- Keep `--save-changes` to persist cookies and storage when the session ends. Allow enough discovery time with `--timeout 600` rather than the CLI's 60-second default.

### 2. Establish Login

Check whether the saved profile is already authenticated. If login is needed, use vault-backed credentials. Never request raw credentials or store them in the skill or `AGENTS.md`.

Inspect the login flow before defining its credential schema. Record credential fields, types, required/sensitive flags, login stages, and field-to-selector mappings; refine these as additional stages become visible.

```bash
kernel browsers playwright execute "$SESSION" 'await page.goto("<login-url>")'
kernel browsers computer screenshot "$SESSION" --to /tmp/login.png
```

Reuse the user's existing credential item and its field names. If absent, define it from the discovered schema without values; adapt this username/password example:

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

Share the returned private collection URL directly with the user; never open it in the agent-controlled browser. Wait for the user to supply credentials:

```bash
kernel vaults items get "$VAULT_NAME" <site-name>-login --wait 60 -o json
```

Wait for status `ready` and the fill action to become available, then fill by field name and selector. Adapt the fields and sequence to the observed form:

```bash
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
```

Never read, print, screenshot, or return filled credential values. If the fill errors, times out, or returns a status other than `completed`, stop and reconcile before retrying or submitting.

After a completed fill, submit and verify the expected logged-in state:

```bash
kernel browsers playwright execute "$SESSION" -o json '
  await Promise.all([
    page.waitForURL("<logged-in-url-pattern>", { timeout: 5000 }),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  return page.url();
'
```

If an existing session lacks stealth and bot detection blocks login, delete it and recreate it with stealth. If login remains blocked, get `browser_live_view_url` with `kernel browsers view "$SESSION" -o json`, ask the user to log in manually, and verify the resulting state.

### 3. Explore and Verify Each Task

Keep each requested task independently runnable, with shared setup and login prerequisites where needed.

1. Navigate to the task's starting state and inspect the page.
2. Perform the task with the selected controls, confirming actual state changes after actions.
3. Record inputs, starting state, direct URLs, ordered commands, wait conditions, success checks, and observed failures or workarounds.
4. Test individual uncertain steps, then verify the complete sequence using the same commands the skill will document. Keep testing within the user's authorization and state any verification limits.

For Kernel's default controls:

- Prefer role, label, or text locators; use CSS or XPath when the site's semantics are insufficient.
- Use `return` for verification results and `-o json` when parsing them. Each `playwright execute` call has a fresh script context; the browser page persists.
- Wait for an observed URL, visible state, response, or value that proves completion. Set explicit short timeouts, such as 5000 ms; use fixed waits only as a last resort. Avoid `networkidle` as the default success condition.
- Use `page.frameLocator(...)` for iframe interactions, including cross-origin frames.

### Computer-Use Fallback

If Playwright cannot complete a step after 2–3 attempts, whether it errors, times out, or reports success without changing page state, use computer controls for that step. Check the outcome before retrying an action that may already have succeeded.

```bash
kernel browsers computer screenshot "$SESSION" --to /tmp/state.png
kernel browsers computer drag-mouse "$SESSION" --point 100,200 --point 250,200 --point 400,200 --button left
kernel browsers computer click-mouse "$SESSION" --x 250 --y 60
kernel browsers computer type "$SESSION" --text "some text"
kernel browsers computer press-key "$SESSION" --key Return
```

Read coordinates from the screenshot and record the viewport size alongside them. Include intermediate drag waypoints so pointer sensors register movement. Keep each gesture entirely within DOM or computer controls; return to Playwright afterward where appropriate.

### 4. Write the Skill

Use the primary automation domain as the folder name: `<skills-directory>/<domain>/SKILL.md`. Resolve the registered skill directory from the target agent's instructions.

Adapt the template below using the verified commands and site-specific findings. Include the chosen controls, setup, login if needed, and cleanup. Keep generic CLI documentation in the linked dependency skill.

Save the discovered credential schema, field-to-selector mappings, login sequence, waits, and success checks in the shared skill. Replace site-specific placeholders with verified details, but keep user IDs, vault/item references, profile references, and account-specific URL components as runtime inputs or resolve them from the current user's context. Never hard-code the discovery user's values.

````markdown
---
name: <descriptive-name>
description: <What the skill does and when to use it.>
---

# <Site Name>

## Setup

<Required tools and skill dependencies, runtime inputs, and tested session setup.>

## Login

<How to check existing authentication; tested vault-backed login and manual fallback if needed.>

## <Task Name>

<Required inputs and starting state.>

```bash
# Tested commands, including necessary waits and verification.
```

<Expected outcome and any task-specific recovery instructions. Repeat for each independent task.>

## Cleanup

<Commands to close the selected harness and delete the Kernel session.>

## Notes

<Observed quirks and workarounds; coordinate/viewport requirements where applicable.>
````

### 5. Clean Up

Close any attached harness and delete the browser session created for discovery. Deletion finalizes profile persistence:

```bash
kernel browsers delete "$SESSION"
```
