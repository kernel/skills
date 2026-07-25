---
name: kernel-python-sdk
description: Build and debug Python browser automation with the Kernel SDK, including browser lifecycle, server-side Playwright, CDP, profiles, proxies, and reliable cleanup.
context: fork
---

## When to Use This Skill

Use this skill to write Python that creates and controls Kernel browser sessions. Prefer it for:

- Server-side Playwright execution in the browser VM
- Client-side Playwright over CDP
- Persistent profiles and explicit proxy routing
- Browser pools or deployed Python actions

Use the `kernel-cli` skill for shell commands and quick one-off sessions.

## Setup

```bash
uv pip install -U kernel
# Add this only for client-side CDP:
uv pip install playwright
```

Set `KERNEL_API_KEY` in the environment; do not put it in source. `Kernel()` and `AsyncKernel()` read it automatically. Use the async client consistently—do not call synchronous SDK methods from an async action.

## Choose an Automation Path

### Server-side Playwright (default)

Run JavaScript/TypeScript next to Chrome. This avoids a local CDP round trip and does not require local Playwright:

```python
from kernel import Kernel

with Kernel() as client:
    browser = client.browsers.create(stealth=True, timeout_seconds=300)
    try:
        response = client.browsers.playwright.execute(
            browser.session_id,
            code="""
await page.goto("https://example.com");
return { title: await page.title(), url: page.url() };
""",
            timeout_sec=60,
        )
        if not response.success:
            raise RuntimeError(response.error or response.stderr or "Playwright execution failed")
        print(response.result)
    finally:
        client.browsers.delete_by_id(browser.session_id)
```

Pass the session ID as the first positional argument. The code receives `page`, `context`, and `browser`. Use `return`; otherwise `response.result` is empty. `timeout_sec` limits remote code execution, while the SDK's `timeout=` option controls the HTTP request.

### Client-side Playwright over CDP

Use CDP when local Playwright tooling or interactive debugging is required:

```python
import asyncio

from kernel import AsyncKernel
from playwright.async_api import async_playwright


async def main() -> None:
    async with AsyncKernel() as client:
        kernel_browser = await client.browsers.create(
            stealth=True,
            timeout_seconds=300,
        )
        try:
            async with async_playwright() as playwright:
                remote = await playwright.chromium.connect_over_cdp(
                    kernel_browser.cdp_ws_url
                )
                context = remote.contexts[0]
                page = context.pages[0] if context.pages else await context.new_page()
                await page.goto("https://example.com")
                print(await page.title())
        finally:
            await client.browsers.delete_by_id(kernel_browser.session_id)


asyncio.run(main())
```

Reuse the existing default context so pages see the Kernel session's loaded profile state; a new incognito context does not share that state. The SDK client context closes HTTP connections, but it does **not** replace deleting the remote browser.

## Browser Lifecycle and Cleanup

- Wrap every created or acquired session in `try/finally` immediately after creation.
- Delete ordinary sessions with `client.browsers.delete_by_id(session_id)`; use `await` with `AsyncKernel`.
- Release pool-acquired sessions through the browser-pool release API instead of deleting them.
- Keep the browser inactivity timeout finite even when cleanup exists. Activity can extend that timeout, so it is not a substitute for explicit cleanup.
- Delete throwaway profiles and proxies only after all sessions using them have ended. Keep intentional persistent profiles.

## Profiles

Create profiles before attaching them. Set `save_changes=True` when cookies and local state must persist back to the profile:

```python
profile = client.profiles.create(name="checkout-login")
browser = client.browsers.create(
    profile={"id": profile.id, "save_changes": True},
    stealth=True,
)
try:
    # Automate with server-side Playwright or CDP.
    ...
finally:
    client.browsers.delete_by_id(browser.session_id)
```

Deleting the browser ends the session and allows profile changes to finalize. Do not delete the profile first. Use either `{"id": ...}` or `{"name": ...}`, not both.

The current Python SDK's `profiles.download(id_or_name)` returns a zstd-compressed tar archive. Save it with:

```python
archive = client.profiles.download(profile.id)
archive.write_to_file("profile.tar.zst")
```

Do not pass the CLI-only `--format` concept to the SDK method. Use `kernel profiles download <id-or-name> --to ./profile --format tar` when server-side decompression and extraction are needed. The current SDK does not expose profile rename; use `kernel profiles update <id-or-name> --name <new-name>`.

## Proxies and Default Stealth Proxy

Attach an explicit proxy at creation with `proxy_id`:

```python
proxy = client.proxies.create(
    type="datacenter",
    config={"country": "US"},
    name="automation-us",
)
try:
    client.proxies.check(proxy.id, url="https://example.com")
    browser = client.browsers.create(stealth=True, proxy_id=proxy.id)
    try:
        ...
    finally:
        client.browsers.delete_by_id(browser.session_id)
finally:
    client.proxies.delete(proxy.id)  # Only if this proxy was created for this run.
```

A target-specific proxy check validates that public HTTP/HTTPS URL. For residential and mobile proxies, it does not guarantee the later browser uses the same exit node; with a custom URL, the check also does not update general proxy health status.

Proxy routing can be changed on a running browser:

```python
client.browsers.update(browser.session_id, proxy_id=another_proxy_id)
client.browsers.update(browser.session_id, proxy_id="")  # Remove explicit proxy.
```

Stealth browsers may use Kernel's default stealth proxy when no explicit proxy is attached. Control it independently:

```python
client.browsers.update(browser.session_id, disable_default_proxy=True)   # Direct connection
client.browsers.update(browser.session_id, disable_default_proxy=False)  # Re-enable default
```

`disable_default_proxy` is an update parameter, not a browser-create parameter. The current SDK does not expose proxy rename; use `kernel proxies update <id> --name <new-name>`. Recreate the proxy to change anything besides its name.

## Deployed Action Pattern

```python
from typing import TypedDict

import kernel

app = kernel.App("app-name")


class TaskInput(TypedDict):
    task: str


@app.action("action-name")
async def run(ctx: kernel.KernelContext, payload: TaskInput):
    async with kernel.AsyncKernel() as client:
        browser = await client.browsers.create(
            invocation_id=ctx.invocation_id,
            timeout_seconds=300,
        )
        try:
            response = await client.browsers.playwright.execute(
                browser.session_id,
                code="return await page.title();",
            )
            if not response.success:
                raise RuntimeError(response.error or response.stderr or "Playwright execution failed")
            return response.result
        finally:
            await client.browsers.delete_by_id(browser.session_id)
```

## Binary Results

Server-side screenshots and PDFs can return a Node.js Buffer-shaped result:

```python
response = client.browsers.playwright.execute(
    browser.session_id,
    code="return await page.screenshot({ fullPage: true });",
)
if response.success and response.result:
    with open("output.png", "wb") as file:
        file.write(bytes(response.result["data"]))
```

## References

- [Kernel documentation](https://www.kernel.sh/docs)
- [Python SDK API reference](https://github.com/kernel/kernel-python-sdk/blob/main/api.md)
- [Kernel quickstart](https://www.kernel.sh/docs/quickstart)
- [Additional examples](./examples/examples.md)
