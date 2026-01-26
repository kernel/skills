---
name: kernel-python-sdk
description: Build browser automation scripts using the Kernel Python SDK with Playwright and remote browser management.
context: fork
---

## When to Use This Skill

Use the Kernel Python SDK when you need to:

- **Build browser automation scripts** - Create Python programs that control remote browsers
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
- `kernel.browser_pools` - Pre-warmed browser pool management
- `kernel.profiles` - Persistent browser profiles (auth state)
- `kernel.proxies` - Proxy configuration
- `kernel.extensions` - Chrome extension management
- `kernel.deployments` - App deployment
- `kernel.invocations` - Action invocation

### Two Automation Approaches

**1. Server-side Execution (RECOMMENDED)**
- Execute Playwright code directly in browser VM using `kernel.browsers.playwright.execute(session_id, code="...")`
  - `session_id` must be passed as a positional argument (first parameter), not as `id=` keyword argument
  - Response from the playwright execute is accessed via `response.result`
  - **CRITICAL: You MUST use `return` in your code to get data back** - without it, `response.result` is `None`
- Code and browser run together in cloud
- No local Playwright installation needed
- Lower latency, higher throughput
- Best for: Most use cases, production automation, parallel execution, actions

**2. CDP Connection (Client-side)**
- Connect Playwright to browser via CDP WebSocket URL
- Code runs locally, browser runs remotely
- Requires local Playwright installation
- Full Playwright API available
- Best for: Complex debugging, specific local development needs

## Best Practices & Common Patterns

### Server-Side Execution Pattern

When using server-side Playwright execution, ALWAYS follow this pattern to avoid common errors:

```python
import asyncio
import time
from kernel import Kernel

async def main():
    client = Kernel()

    # 1. Create browser OUTSIDE try block
    kernel_browser = client.browsers.create(
        stealth=True,
        timeout_seconds=300
    )

    try:
        # 2. ALWAYS wait after browser creation
        time.sleep(3)  # Browser may not be immediately ready

        # 3. Use retry logic for Playwright execution
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = client.browsers.playwright.execute(
                    kernel_browser.session_id,  # MUST be positional argument
                    code="""
                        // Your Playwright code here
                        await page.goto('https://example.com', { waitUntil: 'networkidle' });
                        return await page.evaluate(() => document.title);
                    """
                )
                break  # Success, exit retry loop
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(2)  # Wait before retry
                else:
                    raise  # Re-raise on final attempt

        # 4. ALWAYS check response.success before accessing result
        if response.success and response.result:
            print(f"Result: {response.result}")
        else:
            print(f"Error: {response.error}")
            if response.stderr:
                print(f"Stderr: {response.stderr}")

    finally:
        # 5. ALWAYS cleanup browser in finally block
        client.browsers.delete_by_id(kernel_browser.session_id)

if __name__ == "__main__":
    asyncio.run(main())
```

### Critical Rules for Server-Side Execution

1. **Browser Readiness**: `client.browsers.create()` may return before the browser is fully ready
   - ALWAYS add `time.sleep(3)` after browser creation
   - ALWAYS use retry logic (3 attempts with 2-second delays) for Playwright execution
   - Error `400 - browser not found` means browser wasn't ready yet

2. **Return Values**: MUST use `return` in Playwright code to get data back
   - Without `return`, `response.result` will be `None`
   - Applies to ALL data: strings, objects, arrays, binary data (screenshots, PDFs)

3. **Browser Cleanup**: ALWAYS delete browser in finally block
   - Use `client.browsers.delete_by_id(kernel_browser.session_id)`
   - Put in finally block so it runs even if errors occur

4. **Error Handling**: ALWAYS check `response.success` before accessing `response.result`
   - Check `response.error` and `response.stderr` for debugging

### Common Issues & Solutions
- Use type safe python code
- **`400 - browser not found` error**: Browser not ready yet → Add `time.sleep(3)` and retry logic
- **`response.result` is `None`**: Missing `return` statement in Playwright code
- **`TypeError: 'NoneType' object is not subscriptable`**: Forgot to check `response.success` or missing `return`
- **Browser not cleaned up**: Always use try/finally pattern with deletion in finally block
**Import Patterns**
- Standard import: `from kernel import Kernel`
- For app actions: `import kernel` and `from kernel import Kernel, KernelContext`
- For typed payloads: `from typing import TypedDict`
- For CDP: `from playwright.async_api import async_playwright`

**SDK Initialization**
- Always use `kernel = Kernel()` (reads `KERNEL_API_KEY` from environment automatically)
- Create client at module level: `client = Kernel()`
- Create app at module level: `app = kernel.App("app-name")`

**CDP Connection Pattern (Client-side only)**
```python
async with async_playwright() as playwright:
    browser = await playwright.chromium.connect_over_cdp(kernel_browser.cdp_ws_url)
    context = browser.contexts[0] if browser.contexts else await browser.new_context()
    page = context.pages[0] if context.pages else await context.new_page()
```

**Action Handler Pattern**
```python
class TaskInput(TypedDict):
    task: str

@app.action("action-name")
async def my_action(ctx: kernel.KernelContext, payload: TaskInput):
    # Access payload with dict syntax: payload["task"] or payload.get("task")
    ...
```

**Type Hints and Typing**
- Always use type hints for better IDE support, code clarity, and error detection
- For action handlers, use `TypedDict` for input/output types:
```python
from typing import TypedDict, Optional

class TaskInput(TypedDict):
    task: str
    url: Optional[str]  # Optional fields

class TaskOutput(TypedDict):
    result: str
    success: bool

@app.action("task")
async def my_action(ctx: kernel.KernelContext, payload: TaskInput) -> TaskOutput:
    ...
```
- For regular functions, use type annotations:
```python
from kernel import Kernel

def process_browser(kernel_browser) -> str:
    return kernel_browser.session_id

async def create_and_configure_browser(client: Kernel, stealth: bool = True):
    return client.browsers.create(stealth=stealth)
```
- Common imports: `from typing import TypedDict, Optional, Dict, List, Any`
- Always include return type annotations for functions and async functions

**Resource Cleanup Patterns**
- Always wrap browser usage in try/finally (see Best Practices section above)
- Delete browser in finally block: `client.browsers.delete_by_id(kernel_browser.session_id)`
- For CDP connections: Close Playwright browser before deleting Kernel browser: `await browser.close()`

**Response Handling**
- Always check `response.success` before accessing `response.result`
- Access error info: `response.error`, `response.stderr`
- Common Playwright errors:
  - `Identifier 'page' has already been declared` - tried to declare `const page` when it's already available in the execution context

**Handling Binary Data (Screenshots, PDFs, etc.)**

Follow the server-side execution pattern (see Best Practices above) with these additional considerations:

- Binary data (screenshots, PDFs, files) from Playwright returns as a Node.js Buffer object
- The Buffer comes through as: `{'data': [byte_array], 'type': 'Buffer'}`
- Convert to Python bytes: `data = bytes(response.result['data'])`

**Example - Taking a screenshot:**
```python
import time
from kernel import Kernel

client = Kernel()
kernel_browser = client.browsers.create(stealth=True)

try:
    time.sleep(3)  # Wait for browser readiness

    # Retry logic for reliability
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.browsers.playwright.execute(
                kernel_browser.session_id,
                code="""
                    await page.goto('https://example.com', { waitUntil: 'networkidle' });
                    return await page.screenshot({ fullPage: true });
                """  # MUST use 'return' to get data back
            )
            break
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                raise

    # Check success and convert buffer to bytes
    if response.success and response.result:
        screenshot_data = bytes(response.result['data'])
        with open("screenshot.png", "wb") as f:
            f.write(screenshot_data)
    else:
        print(f"Error: {response.error}")

finally:
    client.browsers.delete_by_id(kernel_browser.session_id)
```

**Common mistakes:**
- Missing `return` → `response.result` will be `None`
- Missing `time.sleep(3)` after browser creation → `400 - browser not found`
- Not checking `response.success` → accessing `None` causes crashes

**No requirements.txt Needed**
- Provide instructions: `uv pip install kernel` or `pip install kernel`
- For Playwright: `uv pip install playwright`


## References

- **Kernel Documentation**: https://www.kernel.sh/docs
- **API Reference**: https://www.kernel.sh/docs/api-reference/
- **Templates**: https://www.kernel.sh/docs/reference/cli/create#available-templates
- **Quickstart Guide**: https://www.kernel.sh/docs/quickstart
