# Creating Site-Specific Browser Automation Skills

This guide walks through creating website automation skills using agent-browser with Kernel cloud browsers.

## Naming Convention

**Use the website's domain as the skill folder name:**

```
.claude/skills/<domain>/SKILL.md
```

Examples:
- `kroger.com/` - For kroger.com automation
- `amazon.com/` - For Amazon automation

Use the primary domain where automation occurs.

## Skill Template

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

## Workflow Discovery Process

### Step 1: Start a Kernel Browser Session

```bash
export KERNEL_PROFILE_NAME=<site name>   # Persist login sessions across runs
agent-browser -p kernel open <site-url>
```

### Step 2: Explore the Login Flow

Most sites require authentication. Document the login process:

1. Navigate to login page
2. Take snapshot: `agent-browser -p kernel snapshot -i`
3. Identify form elements (username, password, submit button)
4. Test filling credentials and submitting
5. Verify successful login (check URL, page content)

**Common login patterns:**
- **Single-page form**: Username and password on same page (e.g., Kroger)
- **Two-step form**: Username first, then password (e.g., Veracross)
- **OAuth redirect**: Site redirects to identity provider

If the site has difficult bot detection or you are struggling and seeing strange behavior of the login page, then it is ok to fall back to asking the user to perform the log in by getting the live view URL of the Kernel browser. Since agent-browser creates the browser, you will need to find the live view URL by running `kernel browsers list`, finding the most recent browser with the profile name you used, and then `kernel browsers view <session id>` to get the live view URL.

### Step 3: Explore User-Requested Workflows

For each workflow the user wants:

1. **Navigate** to the relevant section
2. **Snapshot** to understand available elements
3. **Interact** - try clicks, fills, navigation
4. **Document** the element refs and sequence
5. **Test** the full workflow end-to-end
6. **Record** optimal paths and gotchas

### Step 4: Document Findings

For each workflow, record:
- URL patterns (direct links when available)
- Element refs for key interactions
- Wait times needed between steps
- Verification checks (how to confirm success)
- Edge cases and error handling

## Key Techniques

### Taking Snapshots

```bash
# Interactive elements only (recommended)
agent-browser -p kernel snapshot -i

# Full accessibility tree (more detail)
agent-browser -p kernel snapshot

# Filter with grep
agent-browser -p kernel snapshot -i | grep -i "button|login"
```

### Element Refs

Element refs (`@e1`, `@e2`, etc.) are session-specific and change:
- After page navigation
- After significant DOM updates
- Between browser sessions

**Always take a fresh snapshot before interacting.**

### Handling Tricky Elements

Some elements don't respond to standard commands. Use JavaScript:

```bash
# Click by selector
agent-browser -p kernel eval "document.querySelector('.submit-btn').click()"

# Fill by selector
agent-browser -p kernel eval "document.querySelector('#email').value = 'user@example.com'"

# Click by test ID
agent-browser -p kernel eval "document.querySelector('[data-testid=\"submit\"]').click()"
```

### Handling iframes

If a site has cross-origin iframes, then you will need to execute a playwright script against the page.
See the main kernel-agent-browser skill for more details on this.
You will need to find the session ID for this to work, which you can find with `kernel browsers list`.

### Waiting Strategies

```bash
agent-browser -p kernel wait --load networkidle  # Wait for network
agent-browser -p kernel wait --url "**/dashboard" # Wait for URL
agent-browser -p kernel wait --text "Success"     # Wait for text
agent-browser -p kernel wait 2000              # Fixed wait (ms, last resort)
```

### URL Patterns

Document URL patterns for direct navigation:
```
# Order history
https://www.kroger.com/mypurchases

# Pending orders  
https://www.kroger.com/mypurchases/pending/{order_id}

# Search
https://www.kroger.com/search?query={search_term}
```

## Credential Management

Prompt the user if they want to store credentials in their agent configuration file (e.g., `AGENTS.md`):

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
- Login (may use modal)
- Invoice/amount form
- Stored payment methods
- Confirmation/receipt capture

## Testing and Iteration

1. **Test each step individually** before combining
2. **Document element refs** but note they may change
3. **Add wait times** generously, then optimize
4. **Capture screenshots** of key states for reference
5. **Note failures** - document what doesn't work and workarounds

## Cleanup

Always close the browser when done:

```bash
agent-browser -p kernel close
```

## Example: Creating a New Site Skill

User request: "Create a skill for example.com to check my account balance"

1. **Create skill folder**: `.claude/skills/example.com/`

2. **Start browser and explore**:
   ```bash
   agent-browser -p kernel open https://example.com/login
   agent-browser -p kernel snapshot -i
   ```

3. **Document login flow** (get refs, test credentials)

4. **Find account balance page** (navigate, snapshot, document path)

5. **Write SKILL.md** with:
   - Configuration section
   - Login workflow with actual element refs
   - Account balance workflow
   - Notes on any quirks discovered

6. **Ask user if they want credentials stored**

7. **Test the complete workflow**

8. **Commit to git**
