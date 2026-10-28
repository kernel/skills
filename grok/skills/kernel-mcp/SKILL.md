---
name: kernel-mcp
description: use KERNEL cloud browsers through the KERNEL mcp server. create stealth browser sessions, automate pages with playwright, the browser repl, or computer-use actions, reuse logged-in profiles and managed auth connections, and record replays. use whenever a task needs a real browser, a site that blocks bots, a logged-in session, or screenshots of a live page.
---

# KERNEL mcp

the KERNEL mcp server gives you hosted chromium sessions. nothing runs on the user's machine. every browser is a cloud vm that you create, drive, and delete through mcp tools.

on first use, the user signs in to KERNEL over oauth in their browser. during authorization they can grant org-wide access or limit it to one KERNEL project.

## tools

### session lifecycle
- **manage_browsers**: `create`, `list`, `get`, `update`, `delete`, and `get_telemetry` for browser sessions. `create` returns a session id, cdp url, and live view url. options include `stealth`, `headless`, `proxy_id`, `profile_name`, `viewport_width`/`viewport_height`, and `timeout_seconds`.
- **manage_browser_pools**: pre-warmed pools for high-throughput work. create a pool, `acquire` a browser, and `release` it when done.

### driving a browser
- **execute_playwright_code**: run playwright typescript against an existing session. `page` is already in scope. return a value to get it back.
- **browser_repl**: persistent javascript repl inside the browser vm with playwright, patchright, and raw cdp. state survives across calls. start with `repl.help()`.
- **computer_action**: mouse, keyboard, scroll, and screenshot actions. batch several actions per call and end with a screenshot.
- **webmcp**: call structured tools a page exposes through webmcp. check for these before writing selectors for a site action.
- **browser_curl**: send http requests from inside the browser session, using its cookies and network path.
- **exec_command**: run shell commands inside the browser vm, for example to check dns, files, or logs.

### state and auth
- **manage_profiles**: saved cookies and local storage. `setup` opens a guided session so the user can log in once. pass `profile_name` to `manage_browsers` `create` to reuse it.
- **manage_auth_connections**: managed auth for third-party sites. before a task that needs an account, `list` connections for the domain. if none is authenticated, `login` starts a hosted sign-in flow the user completes in their own browser, so credentials and mfa stay out of chat.
- **manage_proxies**: datacenter, isp, residential, mobile, or custom proxies with country, state, or city targeting.
- **manage_extensions**: list and manage uploaded chrome extensions.

### other
- **manage_replays**: `start` and `stop` mp4 recordings of a session (paid plans).
- **manage_apps**: list apps, check deployment status, and invoke KERNEL apps.
- **search_docs**: search the KERNEL documentation.

## workflows

### browse or scrape a page
1. `manage_browsers` `create` with `stealth: true` if the site has bot detection.
2. `execute_playwright_code` to navigate and extract:
   ```typescript
   await page.goto("https://news.ycombinator.com");
   return await page.$$eval(".titleline > a", els =>
     els.slice(0, 10).map(e => e.textContent)
   );
   ```
3. `manage_browsers` `delete` when finished.

### work on a site that needs a login
1. `manage_auth_connections` `list` with the site's domain.
2. if a connection is `AUTHENTICATED`, create the browser with its `profile_name`. otherwise `create` a connection, run `login`, share the hosted url with the user, and `wait` until it completes.
3. run the task, then delete the browser.

### visual or coordinate-based tasks
1. `computer_action` with a `screenshot` to see the page.
2. batch `click_mouse`, `type_text`, and `press_key`, ending with another `screenshot`.

## tips
- delete browsers when you are done. set `timeout_seconds` as a backstop.
- use `headless: true` when nobody needs the live view. it starts faster.
- share the live view url when the user needs to watch or take over.
- if a session misbehaves, `manage_browsers` `get_telemetry` works on active and deleted sessions.
