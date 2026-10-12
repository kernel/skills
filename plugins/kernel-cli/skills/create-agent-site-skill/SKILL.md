---
name: create-agent-site-skill
description: create reusable skills for automating specific websites with KERNEL cloud browsers. use when building a new site skill or turning an existing browser workflow into one.
---

# create site-specific browser skills

capture working browser workflows as independently runnable tasks in a reusable skill. reuse existing verified workflows; explore missing steps in a live browser within the user's authorized scope.

## choose browser controls

default to `kernel browsers playwright execute` and `kernel browsers computer`. load [kernel-cli](../kernel-cli/SKILL.md) for installation, authentication, and command syntax.

if the caller specifies another harness, use its commands and record that dependency in the generated skill:

- **agent-browser:** load [kernel-agent-browser](../kernel-agent-browser/SKILL.md) and follow its cdp attachment workflow, reusing the browser created below.
- **browser-harness:** load [kernel-browser-harness](../kernel-browser-harness/SKILL.md) when the calling agent uses its `BU_CDP_WS`/`BU_NAME` model.
- **other harnesses:** pass the KERNEL browser's `cdp_ws_url` to the selected harness.

adapt the command examples below to the selected controls; retain the session and credential requirements.

## discover the workflows

### 1. prepare a browser

keep profiles and vaults scoped to both site and user: `<site-name>-<user-id>`. resolve the user id from runtime input or session context; never hard-code it in the shared skill. profiles contain authenticated cookies as well as storage.

for a site requiring login, create the profile and vault once, then reuse them. keep both in the same KERNEL project as the browser. run the creation commands only for resources confirmed absent:

```bash
PROFILE_NAME="<site-name>-<user-id>"
VAULT_NAME="<site-name>-<user-id>"

# First-time setup only:
kernel profiles create --name "$PROFILE_NAME"
kernel vaults create --name "$VAULT_NAME"

# Each run:
SESSION=$(kernel browsers create --profile-name "$PROFILE_NAME" --save-changes --stealth --vault "$VAULT_NAME" --timeout 600 -o json | jq -r '.session_id')
```

- use a headful session (the default); computer-use and live view require it.
- set `--stealth` and attach the vault at creation time; neither can be added later. omit vault setup and `--vault` for sites that do not need login.
- keep `--save-changes` to persist cookies and storage when the session ends. allow enough discovery time with `--timeout 600` rather than the cli's 60-second default.

### 2. establish login

check whether the saved profile is already authenticated. if login is needed, use vault-backed credentials. never request raw credentials or store them in the skill or `AGENTS.md`.

inspect the login flow before defining its credential schema. record credential fields, types, required/sensitive flags, login stages, and field-to-selector mappings; refine these as additional stages become visible.

```bash
kernel browsers playwright execute "$SESSION" 'await page.goto("<login-url>")'
kernel browsers computer screenshot "$SESSION" --to /tmp/login.png
```

reuse the user's existing credential item and its field names. if absent, define it from the discovered schema without values; adapt this username/password example:

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

share the returned private collection url directly with the user. never open it in the agent-controlled browser. `--wait 60` is a single bounded observation, not a retry — poll it while the item is pending and stop once it reaches a terminal state:

```bash
STATUS="pending"
while [ "$STATUS" = "pending" ]; do
  ITEM=$(kernel vaults items get "$VAULT_NAME" <site-name>-login --wait 60 -o json)
  STATUS=$(jq -r '.state.status' <<<"$ITEM")
done
```

if `$STATUS` is `ready`, the fill action is available — fill by field name and selector, adapting the fields and sequence to the observed form. for any other terminal status, stop and reconcile before proceeding.

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

never read, print, screenshot, or return filled credential values. if the fill errors, times out, or returns a status other than `completed`, stop and reconcile before submitting. `fill` never submits, so a retry is safe. retry only after checking the page, and never in an automatic loop.

after a completed fill, submit and verify the expected logged-in state:

```bash
kernel browsers playwright execute "$SESSION" -o json '
  await Promise.all([
    page.waitForURL("<logged-in-url-pattern>", { timeout: 5000 }),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  return page.url();
'
```

if an existing session lacks stealth and bot detection blocks login, delete it and recreate it with stealth. if login remains blocked, get `browser_live_view_url` with `kernel browsers view "$SESSION" -o json`, ask the user to log in manually, and verify the resulting state.

### 3. explore and verify each task

keep each requested task independently runnable, with shared setup and login prerequisites where needed.

1. navigate to the task's starting state and inspect the page.
2. perform the task with the selected controls, confirming actual state changes after actions.
3. record inputs, starting state, direct urls, ordered commands, wait conditions, success checks, and observed failures or workarounds.
4. test individual uncertain steps, then verify the complete sequence using the same commands the skill will document. keep testing within the user's authorization and state any verification limits.

for KERNEL's default controls:

- prefer role, label, or text locators; use css or XPath when the site's semantics are insufficient.
- use `return` for verification results and `-o json` when parsing them. each `playwright execute` call has a fresh script context; the browser page persists.
- wait for an observed url, visible state, response, or value that proves completion. set explicit short timeouts, such as 5000 ms; use fixed waits only as a last resort. avoid `networkidle` as the default success condition.
- use `page.frameLocator(...)` for iframe interactions, including cross-origin frames.

### computer-use fallback

if Playwright cannot complete a step after 2–3 attempts, whether it errors, times out, or reports success without changing page state, use computer controls for that step. check the outcome before retrying an action that may already have succeeded.

```bash
kernel browsers computer screenshot "$SESSION" --to /tmp/state.png
kernel browsers computer drag-mouse "$SESSION" --point 100,200 --point 250,200 --point 400,200 --button left
kernel browsers computer click-mouse "$SESSION" --x 250 --y 60
kernel browsers computer type "$SESSION" --text "some text"
kernel browsers computer press-key "$SESSION" --key Return
```

read coordinates from the screenshot and record the viewport size alongside them. include intermediate drag waypoints so pointer sensors register movement. keep each gesture entirely within dom or computer controls; return to Playwright afterward where appropriate.

### 4. write the skill

use the primary automation domain as the folder name: `<skills-directory>/<domain>/SKILL.md`. resolve the registered skill directory from the target agent's instructions.

adapt the template below using the verified commands and site-specific findings. include the chosen controls, setup, login if needed, and cleanup. keep generic cli documentation in the linked dependency skill.

save the discovered credential schema, field-to-selector mappings, login sequence, waits, and success checks in the shared skill. replace site-specific placeholders with verified details, but keep user ids, vault/item references, profile references, and account-specific url components as runtime inputs or resolve them from the current user's context. never hard-code the discovery user's values.

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

### 5. clean up

close any attached harness and delete the browser session created for discovery. deletion finalizes profile persistence:

```bash
kernel browsers delete "$SESSION"
```
