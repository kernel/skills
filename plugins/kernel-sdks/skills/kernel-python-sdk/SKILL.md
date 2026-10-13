---
name: kernel-python-sdk
description: build and debug Python browser automation with the KERNEL sdk, including browser lifecycle, server-side Playwright, cdp, profiles, proxies, and reliable cleanup.
context: fork
---

## when to use this skill

use this skill to write Python that creates and controls KERNEL browser sessions. prefer it for:

- server-side Playwright execution in the browser vm
- client-side Playwright over cdp
- persistent profiles and explicit proxy routing
- browser pools or deployed Python actions

use the `kernel-cli` skill for shell commands and quick one-off sessions.

## setup

```bash
uv pip install -U kernel
# Add this only for client-side CDP:
uv pip install playwright
```

set `KERNEL_API_KEY` in the environment; do not put it in source. `Kernel()` and `AsyncKernel()` read it automatically. use the async client consistently—do not call synchronous sdk methods from an async action.

## choose an automation path

### server-side Playwright (default)

run JavaScript/TypeScript next to Chrome. this avoids a local cdp round trip and does not require local Playwright:

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

pass the session id as the first positional argument. the code receives `page`, `context`, and `browser`. use `return`; otherwise `response.result` is empty. `timeout_sec` limits remote code execution, while the sdk's `timeout=` option controls the http request.

### client-side Playwright over cdp

use cdp when local Playwright tooling or interactive debugging is required:

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

reuse the existing default context so pages see the KERNEL session's loaded profile state; a new incognito context does not share that state. the sdk client context closes http connections, but it does **not** replace deleting the remote browser.

## browser lifecycle and cleanup

- wrap every created or acquired session in `try/finally` immediately after creation.
- delete ordinary sessions with `client.browsers.delete_by_id(session_id)`; use `await` with `AsyncKernel`.
- release pool-acquired sessions through the browser-pool release api instead of deleting them.
- keep the browser inactivity timeout finite even when cleanup exists. activity can extend that timeout, so it is not a substitute for explicit cleanup.
- delete throwaway profiles and proxies only after all sessions using them have ended. keep intentional persistent profiles.

## profiles

create profiles before attaching them. set `save_changes=True` when cookies and local state must persist back to the profile:

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

deleting the browser ends the session and allows profile changes to finalize. do not delete the profile first. use either `{"id": ...}` or `{"name": ...}`, not both.

the Python sdk can request either archive format and rename profiles natively:

```python
archive = client.profiles.download(profile.id, format="tar")
archive.write_to_file("profile.tar")
client.profiles.update(profile.id, name="checkout-login-v2")
```

the sdk writes an archive for both `tar.zst` and `tar`; it never extracts the contents. use `kernel profiles download <id-or-name> --to ./profile` when the archive must be unpacked into a directory.

## proxies and default stealth proxy

attach an explicit proxy at creation with `proxy_id`:

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

a target-specific proxy check validates that public http/https url. for residential and mobile proxies, it does not guarantee the later browser uses the same exit node; with a custom url, the check also does not update general proxy health status.

proxy routing can be changed on a running browser:

```python
client.browsers.update(browser.session_id, proxy_id=another_proxy_id)
client.browsers.update(browser.session_id, proxy_id="")  # Remove explicit proxy.
```

stealth browsers may use KERNEL's default stealth proxy when no explicit proxy is attached. control it independently:

```python
client.browsers.update(browser.session_id, disable_default_proxy=True)   # Direct connection
client.browsers.update(browser.session_id, disable_default_proxy=False)  # Re-enable default
```

`disable_default_proxy` is an update parameter, not a browser-create parameter. the current sdk does not expose proxy rename; use `kernel proxies update <id> --name <new-name>`. recreate the proxy to change anything besides its name.

## deployed action pattern

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

## binary results

server-side screenshots and pdfs can return a Node.js Buffer-shaped result:

```python
response = client.browsers.playwright.execute(
    browser.session_id,
    code="return await page.screenshot({ fullPage: true });",
)
if response.success and response.result:
    with open("output.png", "wb") as file:
        file.write(bytes(response.result["data"]))
```

## references

- [KERNEL documentation](https://www.kernel.sh/docs)
- [Python sdk api reference](https://github.com/kernel/kernel-python-sdk/blob/main/api.md)
- [KERNEL quickstart](https://www.kernel.sh/docs/quickstart)
- [additional examples](./examples/examples.md)
