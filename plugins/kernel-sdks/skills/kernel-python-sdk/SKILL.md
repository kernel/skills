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

## Choose a Browser Config for a Site

Before creating the first browser for a site, look up a configuration Kernel has already tested there. `lookup` is read-only: it does not visit the site or start any work. When there is no tested configuration yet, start an analysis with `resolve` and keep the stealth default for now. The analysis takes minutes, and its result answers the next lookup for that site.

```python
import hashlib
import json

from kernel import Kernel, NotFoundError


def registry_proxy_id(client: Kernel, create) -> str:
    # A managed recipe is a create payload. Create each recipe once under a stable name and reuse it.
    payload = create.model_dump(exclude_none=True)
    name = "registry-" + hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:12]
    try:
        return client.proxies.retrieve(name).id
    except NotFoundError:
        return client.proxies.create(**{**payload, "name": name}).id


def browser_config_for(client: Kernel, url: str, intent: str) -> dict:
    recommendation = client.config_registry.lookup(url=url).recommendation
    if recommendation and recommendation.type == "recommendation":
        if recommendation.proxy.mode == "managed":
            proxy = {"id": registry_proxy_id(client, recommendation.proxy.create)}
        else:
            proxy = {"mode": "direct"}
        return {**recommendation.browser.model_dump(exclude_none=True), "proxy": proxy}
    # No tested config yet: start an analysis without waiting. It takes minutes,
    # and its result answers the next lookup for this site.
    client.config_registry.resolve(url=url, intent=intent)
    return {"stealth": True}


with Kernel() as client:
    config = browser_config_for(
        client, "https://www.example.com/", "search for a product and open the first result"
    )
    browser = client.browsers.create(**config, timeout_seconds=300)
    # Automate, then delete the browser in `finally` as shown below.
```

- Look up once per site and reuse the config for that site's sessions; there is no need to look up before every action.
- Never create a proxy per session. The stable name lets later runs reuse the proxy the first run created.
- `intent` describes the workflow in plain language. The analysis attempts it and returns `guidance` on what got in the way; `lookup` returns the same `guidance` when it has some, even without a recommendation.
- Pass `allowed_proxy_countries` to `lookup` and `resolve` when traffic must exit from specific countries.
- The config registry needs a Hobbyist plan or higher. Without it, `lookup` returns 403; keep `{"stealth": True}`.

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

The Python SDK can request either archive format and rename profiles natively:

```python
archive = client.profiles.download(profile.id, format="tar")
archive.write_to_file("profile.tar")
client.profiles.update(profile.id, name="checkout-login-v2")
```

The SDK writes an archive for both `tar.zst` and `tar`; it never extracts the contents. Use `kernel profiles download <id-or-name> --to ./profile` when the archive must be unpacked into a directory.

## Proxies and Default Stealth Proxy

Attach an explicit proxy at creation with `proxy_id`:

```python
proxy = client.proxies.create(
    type="isp",
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
