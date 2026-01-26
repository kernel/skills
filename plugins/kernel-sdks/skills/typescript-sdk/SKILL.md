---
name: kernel-typescript-sdk
description: Build browser automation scripts using the Kernel TypeScript SDK with Playwright, CDP, and remote browser management.
context: fork
---

## When to Use This Skill

Use the Kernel TypeScript SDK when you need to:

- **Build browser automation scripts** - Create TypeScript programs that control remote browsers
- **Execute server-side automation** - Run Playwright code directly in the browser VM without local dependencies
- **Manage browser sessions programmatically** - Create, configure, and control browsers from code
- **Build scalable scraping/testing tools** - Use browser pools and profiles for high-volume automation
- **Deploy automation as actions** - Package scripts as Kernel actions for invocation via API

**When NOT to use:**
- For CLI commands (i.e. kernel browsers create), use the `kernel-cli` skill instead
- For quick one-off tasks, the CLI may be simpler than writing code

## Core Concepts

### SDK Architecture

The SDK is organized into resource-based modules:

- `kernel.browsers` - Browser session management (create, list, delete)
- `kernel.browsers.playwright` - Server-side Playwright execution
- `kernel.browsers.computer` - OS-level controls (mouse, keyboard, screenshots)
- `kernel.browserPools` - Pre-warmed browser pool management
- `kernel.profiles` - Persistent browser profiles (auth state)
- `kernel.proxies` - Proxy configuration
- `kernel.extensions` - Chrome extension management
- `kernel.deployments` - App deployment
- `kernel.invocations` - Action invocation

### Two Automation Approaches

**1. Server-side Execution (RECOMMENDED)**
- Execute Playwright code directly in browser VM using `await kernel.browsers.playwright.execute(browser.session_id, { code: ``}`
  - Response form the playwright execute is accessed via `response.result as string`
- Code and browser run together in cloud
- No local Playwright installation needed
- Lower latency, higher throughput
- Best for: Most use cases, production automation, parallel execution, actions

**2. CDP Connection (Client-side)**
- Connect Playwright/Puppeteer to browser via CDP WebSocket URL
- Code runs locally, browser runs remotely
- Requires local Playwright installation
- Full Playwright API available
- Best for: Complex debugging, specific local development needs

#### Common Issues
- Use `snake_case` when accessing attributes (i.e. browser.session_id)
- Avoid using depcrecated functions
- Creating a browser: use these parameters and modify them as needed
  ```
   // Create a new remote browser session
    const browser = await kernel.browsers.create({
      stealth: true,
      headless: false
    });
  ```
  - create the browser before the try/catch scope
- Deleting a browser: `await kernel.browsers.deleteByID(browser.session_id);`
- Accessing the CDP URL: `browser.cdp_ws_url`
- No need to create `package.json`, provide instructions to the user on how to run the script
- **Playwright execute context**: When using `playwright.execute`, the variables `page`, `context`, and `browser` are already available in the execution context. Do NOT redeclare them (e.g., avoid `const page = await context.newPage()`). Use them directly:
  ```
  await kernel.browsers.playwright.execute(browser.session_id, {
    code: `await page.goto('https://example.com'); return page.url();`
  });
  ```
- **Error handling**: Always check `response.success` before accessing `response.result` when using `playwright.execute`:
  ```
  const response = await kernel.browsers.playwright.execute(browser.session_id, { code: '...' });
  if (!response.success) {
    throw new Error(response.error || 'Playwright execution failed');
  }
  const result = response.result as YourType;
  ```
- **Screenshots**: Use the dedicated screenshot API instead of trying to return binary data through `playwright.execute`. Binary data (like screenshots, file contents) does not serialize properly through the Playwright execute API and will result in `undefined` values. Use `kernel.browsers.computer.captureScreenshot(browser.session_id)` which returns a Response with a blob:
  ```
  // First navigate using playwright.execute
  await kernel.browsers.playwright.execute(browser.session_id, {
    code: `await page.goto('https://example.com');`
  });

  // Then capture screenshot using dedicated API
  const screenshotResponse = await kernel.browsers.computer.captureScreenshot(browser.session_id);
  const blob = await screenshotResponse.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  ```
- **Binary data handling**: Never try to return binary data (screenshots, file buffers, images) through `playwright.execute`. The API only serializes JSON-compatible values. Attempting to return binary data will result in `undefined`, causing errors like `Buffer.from(undefined)` or `TypeError [ERR_INVALID_ARG_TYPE]`. Always use dedicated APIs for binary operations:
  - Screenshots: `kernel.browsers.computer.captureScreenshot()`
  - File operations: Use the filesystem APIs, not `playwright.execute` return values
- **Screenshot timing and blank screenshots**: If screenshots are blank, the page may not be fully rendered despite `waitUntil: 'networkidle'`. Solutions:
  - Add `await page.waitForTimeout(3000-5000)` after navigation in `playwright.execute`
  - Add a delay between `playwright.execute` and `captureScreenshot`: `await new Promise(resolve => setTimeout(resolve, 2000))`
  - Try `headless: false` for better rendering on pages
  - Add debugging to verify page loaded: `const title = await page.title(); const bodyHTML = await page.evaluate(() => document.body.innerHTML);`

## References

- **Templates**: https://www.kernel.sh/docs/reference/cli/create#available-templates
- **TypeScript Types**: Available in `@onkernel/sdk` package
- **Kernel Documentation**: https://www.kernel.sh/docs
- **Quickstart Guide**: https://www.kernel.sh/docs/quickstart
