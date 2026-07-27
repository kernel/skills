---
name: kernel-typescript-sdk
description: Build Kernel browser automation in TypeScript with server-side Playwright or CDP, including profiles, proxies, and reliable session cleanup.
context: fork
---

# Kernel TypeScript SDK

## When to Use This Skill

Use this skill to create and automate Kernel browser sessions from TypeScript, persist browser state with profiles, route sessions through proxies, or package automation as Kernel actions.

For one-off `kernel ...` commands, use the `kernel-cli` skill instead.

## Install and Initialize

```bash
npm install @onkernel/sdk
# Only CDP-based automation also needs a local Playwright client:
npm install playwright-core
```

```typescript
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel(); // Reads KERNEL_API_KEY from the environment.
```

Request and response fields use `snake_case` (`timeout_seconds`, `session_id`, `cdp_ws_url`). SDK methods use JavaScript casing (`deleteByID`, `captureScreenshot`).

## Choose an Automation Path

Prefer **server-side Playwright** with `kernel.browsers.playwright.execute()` for most automation. Code runs beside the browser with low latency and does not require a local Playwright installation.

Use a **CDP connection** when a local library must control Playwright directly or when debugging interactively. Connect with `browser.cdp_ws_url` and reuse the browser's existing context.

## Server-Side Playwright Lifecycle

Always delete a created session in `finally`. The idle timeout is a safety net, not the normal cleanup path.

```typescript
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel();
const session = await kernel.browsers.create({
  stealth: true,
  timeout_seconds: 300,
});

try {
  const response = await kernel.browsers.playwright.execute(session.session_id, {
    code: `
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
      return { title: await page.title(), url: page.url() };
    `,
    timeout_sec: 60,
  });

  if (!response.success) {
    throw new Error(response.error ?? response.stderr ?? "Playwright execution failed");
  }

  console.log(response.result);
} finally {
  await kernel.browsers.deleteByID(session.session_id);
}
```

Use `return` inside `code` to populate `response.result`. Each call uses a fresh execution context, so keep dependent steps in one call or return the state needed by the next call.

## CDP Lifecycle

Close the local CDP client, then delete the Kernel session even if connection or automation fails.

```typescript
import { Kernel } from "@onkernel/sdk";
import { chromium } from "playwright-core";

const kernel = new Kernel();
const session = await kernel.browsers.create({ stealth: true, timeout_seconds: 300 });

try {
  const browser = await chromium.connectOverCDP(session.cdp_ws_url);
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("Kernel browser has no default context");

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    console.log(await page.title());
  } finally {
    await browser.close();
  }
} finally {
  await kernel.browsers.deleteByID(session.session_id);
}
```

Do not treat `browser.close()` as Kernel resource cleanup; always call `deleteByID()`.

## Profiles

Create profiles before attaching them. Set `save_changes: true` only when changes from this session should persist when the session ends.

```typescript
const profile = await kernel.profiles.create({ name: "example-login" });
const session = await kernel.browsers.create({
  profile: { id: profile.id, save_changes: true },
  stealth: true,
});

try {
  // Authenticate or automate with playwright.execute or CDP.
} finally {
  await kernel.browsers.deleteByID(session.session_id);
}
```

Prefer profile IDs for long-running work. Do not rename a profile while a browser references it by name; that can prevent session changes from saving. Delete a profile only when it was created as temporary test data, and only after deleting its browser sessions:

```typescript
await kernel.profiles.delete(profile.id);
```

## Proxies and Direct Connections

Attach an existing proxy by ID at creation:

```typescript
const session = await kernel.browsers.create({
  stealth: true,
  proxy_id: process.env.KERNEL_PROXY_ID!,
});
```

Check a configured proxy against a public HTTP(S) target before use when target reachability matters:

```typescript
const checked = await kernel.proxies.check(process.env.KERNEL_PROXY_ID!, {
  url: "https://example.com",
});
if (checked.status === "unavailable") throw new Error("Proxy is unavailable");
```

For a running stealth session, clear an explicit proxy and disable Kernel's default stealth proxy to connect directly:

```typescript
await kernel.browsers.update(session.session_id, {
  proxy_id: "",
  disable_default_proxy: true,
});
```

Set `disable_default_proxy: false` to re-enable the default stealth proxy. `kernel.proxies.update(id, { name })` only renames a proxy; recreate it to change its type or configuration. Delete temporary proxies only after all sessions using them are deleted.

## Binary Data

Do not return screenshots or file bytes from `playwright.execute`. Use the dedicated response endpoints:

```typescript
const screenshot = await kernel.browsers.computer.captureScreenshot(session.session_id);
const screenshotBuffer = Buffer.from(await screenshot.arrayBuffer());

const file = await kernel.browsers.fs.readFile(session.session_id, {
  path: "/tmp/output.pdf",
});
const fileBuffer = Buffer.from(await file.arrayBuffer());
```

## Cleanup Rules

1. Wrap every created browser session in `try/finally` immediately after creation.
2. Delete sessions with `kernel.browsers.deleteByID(session_id)` on success and failure.
3. For CDP, close the local client before deleting the session.
4. Delete temporary profiles and proxies only after dependent sessions are gone.
5. Keep credentials and proxy passwords in environment variables; never embed them in source or logs.

## References

- **Kernel Documentation**: https://www.kernel.sh/docs
- **Quickstart Guide**: https://www.kernel.sh/docs/quickstart
- **TypeScript Types**: Use the declarations and hover docs shipped with `@onkernel/sdk`
- **Additional integration examples**: [examples](./examples/examples.md)
