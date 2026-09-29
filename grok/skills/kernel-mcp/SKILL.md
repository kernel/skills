---
name: kernel-mcp
description: Use Kernel cloud browsers through the Kernel MCP server — create stealth browser sessions, automate pages with Playwright, the Browser REPL, or computer-use actions, reuse logged-in profiles and managed auth connections, and record replays. Use whenever a task needs a real browser, a website that blocks bots, a logged-in session, or screenshots of a live page.
---

# Kernel MCP

The Kernel MCP server gives you hosted Chromium sessions. Nothing runs on the user's machine; every browser is a cloud VM that you create, drive, and delete through MCP tools.

On first use Grok opens a browser window for the user to sign in to Kernel over OAuth. During authorization the user can grant org-wide access or limit it to one Kernel project.

## Tools

### Session lifecycle
- **manage_browsers** — `create`, `list`, `get`, `update`, `delete`, and `get_telemetry` for browser sessions. `create` returns a session ID, CDP URL, and live view URL. Options include `stealth`, `headless`, `proxy_id`, `profile_name`, `viewport_width`/`viewport_height`, and `timeout_seconds`.
- **manage_browser_pools** — pre-warmed pools for high-throughput work: create a pool, `acquire` a browser, `release` it when done.

### Driving a browser
- **execute_playwright_code** — run Playwright TypeScript against an existing session. `page` is already in scope; return a value to get it back.
- **browser_repl** — persistent JavaScript REPL inside the browser VM with Playwright, Patchright, and raw CDP. State survives across calls. Start with `repl.help()`.
- **computer_action** — mouse, keyboard, scroll, and screenshot actions. Batch several actions per call and end with a screenshot.
- **webmcp** — call structured tools a page exposes through WebMCP. Check for these before writing selectors for a site action.
- **browser_curl** — make HTTP requests from inside the browser session, using its cookies and network path.
- **exec_command** — run shell commands inside the browser VM, e.g. to check DNS, files, or logs.

### State and auth
- **manage_profiles** — saved cookies and local storage. `setup` opens a guided session so the user can log in once; pass `profile_name` to `manage_browsers create` to reuse it.
- **manage_auth_connections** — managed auth for third-party sites. Before a task that needs an account, `list` connections for the domain. If none is authenticated, `login` starts a hosted sign-in flow the user completes in their own browser, so credentials and MFA stay out of chat.
- **manage_proxies** — datacenter, ISP, residential, mobile, or custom proxies with country/state/city targeting.
- **manage_extensions** — list and manage uploaded Chrome extensions.

### Other
- **manage_replays** — `start` and `stop` MP4 recordings of a session (paid plans).
- **manage_apps** — list, deploy status, and invoke Kernel apps.
- **search_docs** — search the Kernel documentation.

## Workflows

### Browse or scrape a page
1. `manage_browsers` `create` with `stealth: true` if the site has bot detection.
2. `execute_playwright_code` to navigate and extract:
   ```typescript
   await page.goto("https://news.ycombinator.com");
   return await page.$$eval(".titleline > a", els =>
     els.slice(0, 10).map(e => e.textContent)
   );
   ```
3. `manage_browsers` `delete` when finished.

### Work on a site that needs a login
1. `manage_auth_connections` `list` with the site's domain.
2. If a connection is `AUTHENTICATED`, create the browser with its `profile_name`. Otherwise `create` a connection, run `login`, share the hosted URL with the user, and `wait` until it completes.
3. Run the task, then delete the browser.

### Visual or coordinate-based tasks
1. `computer_action` with a `screenshot` to see the page.
2. Batch `click_mouse`, `type_text`, and `press_key`, ending with another `screenshot`.

## Tips
- Delete browsers when you are done. Set `timeout_seconds` as a backstop.
- Use `headless: true` when nobody needs the live view; it starts faster.
- Share the live view URL with the user when they need to watch or take over.
- If a session misbehaves, `manage_browsers` `get_telemetry` works on active and deleted sessions.
