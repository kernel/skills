# Kernel TypeScript SDK - Examples

Concise patterns extracted from production templates showing how to integrate the Kernel SDK with popular libraries and frameworks.

---

## Stagehand Library Integration

Connect Stagehand to Kernel browsers for AI-powered browser automation with `act()` and `extract()`.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { Kernel } from "@onkernel/sdk";
import { z } from "zod";

const kernel = new Kernel();

const kernelBrowser = await kernel.browsers.create({ stealth: true });

try {
  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      cdpUrl: kernelBrowser.cdp_ws_url,
    },
    model: "openai/gpt-4.1",
    apiKey: process.env.OPENAI_API_KEY,
    verbose: 1,
    domSettleTimeout: 30_000,
  });
  await stagehand.init();

  const page = stagehand.context.pages()[0];
  await page.goto("https://example.com");

  await stagehand.act("Click the login button");

  const data = await stagehand.extract(
    "Extract the main heading text",
    z.object({ heading: z.string() })
  );

  await stagehand.close();
} finally {
  await kernel.browsers.deleteByID(kernelBrowser.session_id);
}
```

---

## Reusable Browser Session Manager

A class for managing browser lifecycle with optional replay recording.

```typescript
import type { Kernel } from "@onkernel/sdk";

interface SessionOptions {
  stealth?: boolean;
  timeoutSeconds?: number;
  recordReplay?: boolean;
}

class KernelBrowserSession {
  private kernel: Kernel;
  private options: SessionOptions;
  private _sessionId: string | null = null;
  private _replayId: string | null = null;

  liveViewUrl: string | null = null;
  replayViewUrl: string | null = null;

  constructor(kernel: Kernel, options: SessionOptions = {}) {
    this.kernel = kernel;
    this.options = { stealth: true, timeoutSeconds: 300, ...options };
  }

  get sessionId(): string {
    if (!this._sessionId) throw new Error("Session not started");
    return this._sessionId;
  }

  async start(): Promise<void> {
    const browser = await this.kernel.browsers.create({
      stealth: this.options.stealth,
      timeout_seconds: this.options.timeoutSeconds,
    });
    this._sessionId = browser.session_id;
    this.liveViewUrl = browser.browser_live_view_url;

    if (this.options.recordReplay) {
      const replay = await this.kernel.browsers.replays.start(this._sessionId);
      this._replayId = replay.replay_id;
    }
  }

  async stop(): Promise<void> {
    if (!this._sessionId) return;

    try {
      if (this._replayId) {
        await this.kernel.browsers.replays.stop(this._replayId, {
          id: this._sessionId,
        });
        // Poll for replay URL
        const replays = await this.kernel.browsers.replays.list(this._sessionId);
        const replay = replays.find((r) => r.replay_id === this._replayId);
        this.replayViewUrl = replay?.replay_view_url ?? null;
      }
    } finally {
      await this.kernel.browsers.deleteByID(this._sessionId);
      this._sessionId = null;
    }
  }
}
```

**Usage:**

```typescript
const session = new KernelBrowserSession(kernel, { recordReplay: true });
await session.start();
try {
  // Use session.sessionId for automation
} finally {
  await session.stop();
  console.log("Replay:", session.replayViewUrl);
}
```

---

## CDP Connection Pattern

Connect local Playwright to a Kernel browser via CDP WebSocket.

```typescript
import { Kernel } from "@onkernel/sdk";
import { chromium } from "playwright-core";

const kernel = new Kernel();

const kernelBrowser = await kernel.browsers.create({ stealth: true });

try {
  const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);

  // IMPORTANT: Get existing context/page instead of creating new ones
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());

  await page.goto("https://example.com");
  const title = await page.title();

  await browser.close();
} finally {
  await kernel.browsers.deleteByID(kernelBrowser.session_id);
}
```

---

## Auto-CAPTCHA with Stealth Mode

Use stealth mode to leverage Kernel's automatic CAPTCHA solving.

```typescript
import { Kernel } from "@onkernel/sdk";
import { chromium } from "playwright-core";

const kernel = new Kernel();

// Stealth mode enables auto-CAPTCHA solving
const kernelBrowser = await kernel.browsers.create({ stealth: true });

console.log("Live view:", kernelBrowser.browser_live_view_url);

try {
  const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());

  // Navigate to page with CAPTCHA - Kernel auto-solves it
  await page.goto("https://www.google.com/recaptcha/api2/demo");

  await browser.close();
} finally {
  await kernel.browsers.deleteByID(kernelBrowser.session_id);
}
```

---

## Server-Side Execution as LLM Tool

Wrap `playwright.execute` as a callable tool for LLM agent frameworks.

```typescript
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel();

function createPlaywrightTool(sessionId: string) {
  return async (code: string, timeoutSec = 60) => {
    try {
      const result = await kernel.browsers.playwright.execute(sessionId, {
        code,
        timeout_sec: timeoutSec,
      });

      if (result.success) {
        const output =
          result.result !== undefined
            ? JSON.stringify(result.result, null, 2)
            : "Executed successfully (no return value)";
        return { content: [{ type: "text", text: output }] };
      } else {
        return {
          content: [{ type: "text", text: `Error: ${result.error}\n${result.stderr || ""}` }],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed: ${error}` }],
        isError: true,
      };
    }
  };
}
```

---

## Magnitude Library Integration

Connect Magnitude's browser agent to Kernel for AI-driven automation.

```typescript
import { Kernel } from "@onkernel/sdk";
import { startBrowserAgent } from "magnitude-core";
import { z } from "zod";

const kernel = new Kernel();

const kernelBrowser = await kernel.browsers.create({ stealth: true });

console.log("Live view:", kernelBrowser.browser_live_view_url);

const agent = await startBrowserAgent({
  url: "https://example.com",
  llm: {
    provider: "anthropic",
    options: {
      model: "claude-sonnet-4-20250514",
      apiKey: process.env.ANTHROPIC_API_KEY!,
    },
  },
  browser: { cdp: kernelBrowser.cdp_ws_url },
  narrate: true,
});

try {
  await agent.act("Scroll down and explore the page");

  const urls = await agent.extract(
    "Extract up to 5 URLs from the page",
    z.array(z.string().url())
  );

  console.log("Found URLs:", urls);
} finally {
  await agent.stop();
  await kernel.browsers.deleteByID(kernelBrowser.session_id);
}
```

---

## Action Handler Pattern

Standard Kernel action pattern for deployable automation.

```typescript
import { Kernel, type KernelContext } from "@onkernel/sdk";
import { chromium } from "playwright-core";

const kernel = new Kernel();
const app = kernel.app("my-app");

interface Input {
  url: string;
}

interface Output {
  title: string;
}

app.action<Input, Output>("get-title", async (ctx: KernelContext, payload?: Input): Promise<Output> => {
  if (!payload?.url) throw new Error("URL required");

  const kernelBrowser = await kernel.browsers.create({
    invocation_id: ctx.invocation_id, // Links browser to this invocation
    stealth: true,
  });

  console.log("Live view:", kernelBrowser.browser_live_view_url);

  try {
    const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());

    await page.goto(payload.url);
    const title = await page.title();

    return { title };
  } finally {
    await kernel.browsers.deleteByID(kernelBrowser.session_id);
  }
});

// Deploy: kernel deploy index.ts
// Invoke: kernel invoke my-app get-title -p '{"url": "https://example.com"}'
```
