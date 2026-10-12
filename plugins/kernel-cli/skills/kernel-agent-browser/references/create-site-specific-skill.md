# Creating Site-Specific Browser Automation Skills

this guide walks through creating website automation skills using agent-browser with KERNEL cloud browsers.

## naming convention

**use the website's domain as the skill folder name:**

```
.claude/skills/<domain>/SKILL.md
```

examples:
- `kroger.com/` - for kroger.com automation
- `amazon.com/` - for Amazon automation

use the primary domain where automation occurs.

## skill template

```markdown
---
name: <descriptive-name>
description: <what the skill does>. Use when <trigger conditions>.
---

# <Site Name>

Uses agent-browser with Kernel cloud browser provider. See the `kernel-agent-browser` skill for best practices.

## Configuration

Set environment variables to configure the Kernel browser. These must be set before your first `agent-browser -p kernel` call since the CLI holds state between invocations.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **Required.** Your Kernel API key for authentication | (none) |
| `KERNEL_STEALTH` | Enable stealth mode to avoid bot detection (`true`/`false`) | `true` |
| `KERNEL_TIMEOUT_SECONDS` | Session timeout in seconds | `300` |
| `KERNEL_PROFILE_NAME` | Browser profile name for persistent cookies/logins | (none) |

**Profile Persistence:** When `KERNEL_PROFILE_NAME` is set, the profile will be created if it doesn't already exist. Cookies, logins, and session data are automatically saved back to the profile when the browser session ends.

### Example Configuration

\`\`\`bash
export KERNEL_API_KEY="your-api-key"
export KERNEL_TIMEOUT_SECONDS=600   # 10-minute session timeout
export KERNEL_STEALTH=true          # Enable stealth mode (default)
export KERNEL_PROFILE_NAME=mysite   # Persist login sessions across runs
\`\`\`

Make sure to use `-p kernel` flag with each command.

## Login Workflow

### 1. Open login page

\`\`\`bash
agent-browser -p kernel open <login-url>
\`\`\`

### 2. Enter credentials

\`\`\`bash
agent-browser -p kernel snapshot -i
agent-browser -p kernel fill @eN "<username>"
agent-browser -p kernel fill @eM "<password>"
agent-browser -p kernel click @eX   # Submit button
agent-browser -p kernel wait 3000
\`\`\`

If you run into bot detection or are struggling to perform the login, figure out the live view URL for the Kernel browser and prompt the user to perform the login.

### 3. Verify login success

\`\`\`bash
agent-browser -p kernel get url
# Should show: <expected-logged-in-url>
\`\`\`

## Quick Login (All Steps)

\`\`\`bash
agent-browser -p kernel open <login-url>
agent-browser -p kernel wait 2000
agent-browser -p kernel snapshot -i
agent-browser -p kernel fill @eN "<username>"
agent-browser -p kernel fill @eM "<password>"
agent-browser -p kernel click @eX
agent-browser -p kernel wait 3000
\`\`\`

## <Workflow Name>

<Document each workflow the user needs>

## Cleanup

\`\`\`bash
agent-browser -p kernel close
\`\`\`

## Notes

<Document quirks, gotchas, and special handling>
```

## workflow discovery process

### step 1: start a KERNEL browser session

```bash
export KERNEL_PROFILE_NAME=<site name>   # Persist login sessions across runs
agent-browser -p kernel open <site-url>
```

### step 2: explore the login flow

most sites require authentication. document the login process:

1. navigate to login page
2. take snapshot: `agent-browser -p kernel snapshot -i`
3. identify form elements (username, password, submit button)
4. test filling credentials and submitting
5. verify successful login (check url, page content)

**common login patterns:**
- **single-page form**: username and password on same page (e.g., Kroger)
- **two-step form**: username first, then password (e.g., Veracross)
- **OAuth redirect**: site redirects to identity provider

if the site has difficult bot detection or you are struggling and seeing strange behavior of the login page, then it is ok to fall back to asking the user to perform the log in by getting the live view url of the KERNEL browser. since agent-browser creates the browser, you will need to find the live view url by running `kernel browsers list`, finding the most recent browser with the profile name you used, and then `kernel browsers view <session id>` to get the live view url.

### step 3: explore user-requested workflows

for each workflow the user wants:

1. **navigate** to the relevant section
2. **snapshot** to understand available elements
3. **interact** - try clicks, fills, navigation
4. **document** the element refs and sequence
5. **test** the full workflow end-to-end
6. **record** optimal paths and gotchas

### step 4: document findings

for each workflow, record:
- url patterns (direct links when available)
- element refs for key interactions
- wait times needed between steps
- verification checks (how to confirm success)
- Edge cases and error handling

## key techniques

### taking snapshots

```bash
# Interactive elements only (recommended)
agent-browser -p kernel snapshot -i

# Full accessibility tree (more detail)
agent-browser -p kernel snapshot

# Filter with grep
agent-browser -p kernel snapshot -i | grep -i "button|login"
```

### element refs

element refs (`@e1`, `@e2`, etc.) are session-specific and change:
- after page navigation
- after significant dom updates
- between browser sessions

**always take a fresh snapshot before interacting.**

### handling tricky elements

some elements don't respond to standard commands. use JavaScript:

```bash
# Click by selector
agent-browser -p kernel eval "document.querySelector('.submit-btn').click()"

# Fill by selector
agent-browser -p kernel eval "document.querySelector('#email').value = 'user@example.com'"

# Click by test ID
agent-browser -p kernel eval "document.querySelector('[data-testid=\"submit\"]').click()"
```

### handling iframes

if a site has cross-origin iframes, then you will need to execute a Playwright script against the page.
see the main kernel-agent-browser skill for more details on this.
you will need to find the session id for this to work, which you can find with `kernel browsers list`.

### waiting strategies

```bash
agent-browser -p kernel wait --load networkidle  # Wait for network
agent-browser -p kernel wait --url "**/dashboard" # Wait for URL
agent-browser -p kernel wait --text "Success"     # Wait for text
agent-browser -p kernel wait 2000              # Fixed wait (ms, last resort)
```

### url patterns

document url patterns for direct navigation:
```
# Order history
https://www.kroger.com/mypurchases

# Pending orders  
https://www.kroger.com/mypurchases/pending/{order_id}

# Search
https://www.kroger.com/search?query={search_term}
```

## credential management

prompt the user if they want to store credentials in their agent configuration file (e.g., `AGENTS.md`):

```markdown
### <Site Name>
- **URL**: <login-url>
- **Username**: <username>
- **Password**: <password>
```

reference credentials from the skill but don't duplicate the actual values in SKILL.md if they're already stored elsewhere.

## common patterns by site type

### E-commerce sites (Kroger, Amazon)
- login → account menu → order history
- search → product page → add to cart
- cart → checkout flow
- pending orders / order modification

### portal/dashboard sites (Veracross, YNAB)
- login (often OAuth-based)
- navigation sidebar/menu
- data tables with pagination
- modal dialogs for details

### bill payment sites
- login (may use modal)
- invoice/amount form
- stored payment methods
- confirmation/receipt capture

## testing and iteration

1. **test each step individually** before combining
2. **document element refs** but note they may change
3. **add wait times** generously, then optimize
4. **capture screenshots** of key states for reference
5. **note failures** - document what doesn't work and workarounds

## cleanup

always close the browser when done:

```bash
agent-browser -p kernel close
```

## example: creating a new site skill

user request: "create a skill for example.com to check my account balance"

1. **create skill folder**: `.claude/skills/example.com/`

2. **start browser and explore**:
   ```bash
   agent-browser -p kernel open https://example.com/login
   agent-browser -p kernel snapshot -i
   ```

3. **document login flow** (get refs, test credentials)

4. **find account balance page** (navigate, snapshot, document path)

5. **write SKILL.md** with:
   - configuration section
   - login workflow with actual element refs
   - account balance workflow
   - notes on any quirks discovered

6. **ask user if they want credentials stored**

7. **test the complete workflow**

8. **commit to git**
