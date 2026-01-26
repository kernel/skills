# Kernel Python SDK - Examples

Concise patterns extracted from production templates showing how to integrate the Kernel SDK with popular libraries and frameworks.

---

## Browser-Use Library Integration

Connect the `browser-use` library to Kernel browsers for AI-powered browser automation.

```python
from browser_use import Agent, Browser
from browser_use.llm import ChatOpenAI
from kernel import Kernel

client = Kernel()
llm = ChatOpenAI(model="gpt-4.1")

kernel_browser = client.browsers.create(stealth=True)
try:
    # Connect browser-use to Kernel via CDP
    browser = Browser(
        cdp_url=kernel_browser.cdp_ws_url,
        headless=False,
        window_size={"width": 1920, "height": 1080},
        viewport={"width": 1920, "height": 1080},
    )

    agent = Agent(task="Your task here", llm=llm, browser_session=browser)
    result = await agent.run()

    # Handle results
    if result.final_result():
        output = result.final_result()
    else:
        output = result.errors()
finally:
    client.browsers.delete_by_id(kernel_browser.session_id)
```

---

## Reusable Async Context Manager

Create a reusable context manager for browser lifecycle with optional replay recording.

```python
from dataclasses import dataclass, field
from typing import Optional
from kernel import Kernel

@dataclass
class KernelBrowserSession:
    stealth: bool = True
    timeout_seconds: int = 300
    record_replay: bool = False
    replay_grace_period: float = 5.0

    session_id: Optional[str] = field(default=None, init=False)
    live_view_url: Optional[str] = field(default=None, init=False)
    replay_id: Optional[str] = field(default=None, init=False)
    replay_view_url: Optional[str] = field(default=None, init=False)
    _kernel: Optional[Kernel] = field(default=None, init=False)

    async def __aenter__(self) -> "KernelBrowserSession":
        self._kernel = Kernel()
        browser = self._kernel.browsers.create(
            stealth=self.stealth,
            timeout_seconds=self.timeout_seconds,
        )
        self.session_id = browser.session_id
        self.live_view_url = browser.browser_live_view_url

        # Start replay recording if enabled
        if self.record_replay:
            replay = self._kernel.browsers.replays.start(self.session_id)
            self.replay_id = replay.replay_id

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._kernel and self.session_id:
            try:
                if self.record_replay and self.replay_id:
                    await asyncio.sleep(self.replay_grace_period)
                    self._kernel.browsers.replays.stop(
                        replay_id=self.replay_id,
                        id=self.session_id,
                    )
                    # Poll for replay URL
                    replays = self._kernel.browsers.replays.list(self.session_id)
                    for replay in replays:
                        if replay.replay_id == self.replay_id:
                            self.replay_view_url = replay.replay_view_url
            finally:
                self._kernel.browsers.delete_by_id(self.session_id)

    @property
    def kernel(self) -> Kernel:
        if self._kernel is None:
            raise RuntimeError("Session not initialized")
        return self._kernel
```

**Usage:**

```python
async with KernelBrowserSession(record_replay=True) as session:
    # Use session.session_id, session.kernel
    result = session.kernel.browsers.playwright.execute(
        session.session_id,
        code="await page.goto('https://example.com'); return await page.title();"
    )
# Browser automatically cleaned up, replay available at session.replay_view_url
```

---

## Auto-CAPTCHA with CDP Connection

Use CDP connection with stealth mode to leverage Kernel's automatic CAPTCHA solving.

```python
from playwright.async_api import async_playwright
from kernel import Kernel

client = Kernel()

# Create browser with stealth mode enabled
kernel_browser = client.browsers.create(stealth=True)

try:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.connect_over_cdp(
            kernel_browser.cdp_ws_url
        )

        # IMPORTANT: Get existing context/page instead of creating new ones
        context = (
            browser.contexts[0] if browser.contexts
            else await browser.new_context()
        )
        page = (
            context.pages[0] if context.pages
            else await context.new_page()
        )

        # Navigate to page with CAPTCHA
        await page.goto("https://www.google.com/recaptcha/api2/demo")

        # Kernel automatically solves CAPTCHAs in stealth mode
        # Watch via live view: kernel_browser.browser_live_view_url

        await browser.close()
finally:
    client.browsers.delete_by_id(kernel_browser.session_id)
```

---

## Server-Side Execution as LLM Tool

Wrap `playwright.execute` as a callable tool for LLM agent frameworks.

```python
import json
from kernel import Kernel

client = Kernel()

def create_playwright_tool(session_id: str):
    """
    Create a Playwright execution tool for LLM agents.
    Returns a callable that executes Playwright code and returns formatted results.
    """
    def execute_playwright(code: str, timeout_sec: int = 60) -> dict:
        """
        Execute Playwright code against the browser.

        Args:
            code: Playwright/JavaScript code to execute
            timeout_sec: Execution timeout in seconds

        Returns:
            Dict with 'content' (result text) and optional 'is_error' flag
        """
        try:
            result = client.browsers.playwright.execute(
                session_id,
                code=code,
                timeout_sec=timeout_sec,
            )

            if result.success:
                output = (
                    json.dumps(result.result, indent=2)
                    if result.result is not None
                    else "Code executed successfully (no return value)"
                )
                return {"content": [{"type": "text", "text": output}]}
            else:
                error_msg = f"Execution failed: {result.error or 'Unknown error'}\n{result.stderr or ''}"
                return {
                    "content": [{"type": "text", "text": error_msg}],
                    "is_error": True,
                }
        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"Failed to execute: {e}"}],
                "is_error": True,
            }

    return execute_playwright
```

**Usage with Claude Agent SDK:**

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

# Create browser
browser = client.browsers.create(stealth=True)

# Create tool
playwright_tool = create_playwright_tool(browser.session_id)

# Register with agent framework
server = create_sdk_mcp_server(
    name="kernel-playwright",
    tools=[playwright_tool],
)
```

---
