---
name: kernel-typescript-sdk
description: Build browser automation scripts using the Kernel TypeScript SDK with Playwright, CDP, and remote browser management.
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
      headless: true // or false for headful
    });
  ```
  - create the browser before the try/catch scope
- Deleting a browser: `await kernel.browsers.deleteByID(browser.session_id);`
- Accessing the CDP URL: `browser.cdp_ws_url`
- No need to create `package.json`, provide instructions to the user on how to run the script

## References

- **API Reference**: https://www.kernel.sh/docs/api-reference/
- **Templates**: https://www.kernel.sh/docs/reference/cli/create#available-templates
- **TypeScript Types**: Available in `@onkernel/sdk` package
- **Kernel Documentation**: https://www.kernel.sh/docs
- **Quickstart Guide**: https://www.kernel.sh/docs/quickstart
