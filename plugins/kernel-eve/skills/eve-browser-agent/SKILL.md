---
name: eve-browser-agent
description: Give a Vercel eve agent a real web browser. Use when building an eve agent that must browse, act on, or extract data from live websites — it drives a Kernel cloud browser through server-side Playwright execution, keeps one session alive across turns, and hands off to a human through the browser's live view.
---

# Eve Browser Agent (Kernel)

This skill turns a [Vercel eve](https://vercel.com/eve) agent into a browser agent: an agent that acts on the live internet through a real, stealth-capable [Kernel](https://www.kernel.sh) cloud browser instead of guessing at page content. Use it whenever a task needs a website — logging in, filling forms, clicking through a flow, scraping structured data, checking that something rendered.

The control surface is Kernel's **Playwright execution API** (`kernel.browsers.playwright.execute`). Your agent writes small Playwright snippets and Kernel runs them *inside the browser's VM*, returning structured data. Nothing about a browser binary, a Chromium download, or a CDP socket lives in the eve runtime — the tool only needs the thin `@onkernel/sdk` HTTP client.

## When to use this skill

Use it when your eve agent needs to:

- **Act on real websites** — navigate, click, type, submit, read back results.
- **Extract live data** — pull structured values off a page an API doesn't expose.
- **Persist logins** — reuse cookies across sessions via a Kernel profile.
- **Get past bot detection** — run a stealth browser with a residential/ISP proxy.
- **Loop a human in** — pause on a login wall or a judgment call and share the live view so a person acts in the same browser, then resume.

**When not to use it:** if a plain HTTP API answers the question, call that instead of driving a browser. For local scripts that aren't eve agents, use the `kernel-typescript-sdk` skill directly.

## Why Playwright execution, not CDP

Kernel exposes four ways to drive a browser (computer use, Playwright execution, raw CDP, WebDriver BiDi). For an eve agent, Playwright execution is the right base:

- **No local browser** — the snippet runs in Kernel's VM. eve tools run on serverless functions, so there is no Chromium to install and no socket to keep open.
- **Survives eve's pauses and redeploys** — you hold a stateless `session_id`, not a live connection. eve sessions are durable workflows that can pause for a human and resume after a redeploy; a `session_id` is still valid on the other side, while a CDP websocket would be long dead.
- **Lower bot-detection surface** — a direct CDP connection introduces a fingerprint. Playwright execution runs co-located and ships stealth (Patchright) by default.

## The model: create → execute → release

1. **`create_browser`** once at the start of a web task. Keep the returned `session_id` and reuse it for every step. Turn on `stealth` for real-world sites.
2. **`browser_execute`** to act. Write a Playwright body; `page`, `context`, and `browser` are in scope. End with a `return` to get data back.
3. **`release_browser`** when the task is done — unless you mean to resume the same browser in a later turn, in which case keep the `session_id` and let it stand by.

## The three tools

Drop these into `agent/tools/`. The filename is the tool name eve shows the model. Full runnable copies (plus an `agent.ts`, `instructions.md`, and a working Slack channel) are in [`examples/`](./examples).

### `agent/tools/create_browser.ts`

```typescript
import { defineTool } from "eve/tools";
import { z } from "zod";
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel(); // reads KERNEL_API_KEY from the environment

export default defineTool({
  description:
    "Create a Kernel cloud browser and return its session id and live view URL. Reuse one session across turns; only create another when you need a fresh browser. Turn on stealth for sites with bot detection, pass a proxy for IP/geo control, and pass a profile name to reuse saved logins.",
  inputSchema: z.object({
    stealth: z.boolean().optional().describe("Reduce anti-bot detection. Recommended for real sites."),
    proxy_id: z.string().optional().describe("Route traffic through a configured Kernel proxy."),
    profile_name: z.string().optional().describe("Load a pre-created profile so saved logins are available."),
    start_url: z.string().url().optional().describe("URL to open when the browser starts."),
    timeout_seconds: z
      .number()
      .int()
      .optional()
      .describe("Inactivity timeout before the browser is destroyed. Default 60; raise for long tasks."),
  }),
  async execute({ stealth, proxy_id, profile_name, start_url, timeout_seconds }) {
    const browser = await kernel.browsers.create({
      stealth,
      proxy_id,
      start_url,
      timeout_seconds,
      profile: profile_name ? { name: profile_name } : undefined,
    });
    return {
      session_id: browser.session_id,
      live_view_url: browser.browser_live_view_url,
    };
  },
});
```

### `agent/tools/browser_execute.ts`

```typescript
import { defineTool } from "eve/tools";
import { z } from "zod";
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel();

export default defineTool({
  description:
    "Run Playwright/TypeScript against a live Kernel browser. `page`, `context`, and `browser` are in scope, and the code runs inside the browser's VM. End with a `return` to get data back. Binary data (screenshots, downloads) does not serialize through this tool — use dedicated Kernel APIs for those.",
  inputSchema: z.object({
    session_id: z.string().describe("Session id from create_browser."),
    code: z
      .string()
      .describe("Playwright body. Example: await page.goto('https://example.com'); return await page.title();"),
    timeout_sec: z
      .number()
      .int()
      .min(1)
      .max(300)
      .optional()
      .describe("Max execution time in seconds. Default 60."),
  }),
  async execute({ session_id, code, timeout_sec }) {
    const res = await kernel.browsers.playwright.execute(session_id, { code, timeout_sec });
    if (!res.success) {
      throw new Error(res.error ?? res.stderr ?? "Playwright execution failed");
    }
    return { result: res.result, stdout: res.stdout };
  },
});
```

The `execute` response is `{ success, result?, error?, stdout?, stderr? }` — there is no replay or video URL on it. Video replays are a separate Kernel API.

### `agent/tools/release_browser.ts`

```typescript
import { defineTool } from "eve/tools";
import { z } from "zod";
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel();

export default defineTool({
  description:
    "Delete a Kernel browser session when the task is done, freeing the resource. Skip this only if you intend to resume the same session in a later turn.",
  inputSchema: z.object({
    session_id: z.string().describe("Session id from create_browser."),
  }),
  async execute({ session_id }) {
    await kernel.browsers.deleteByID(session_id);
    return { released: session_id };
  },
});
```

## Writing execute snippets

- **Return to get data.** The code runs inside a function; whatever you `return` comes back as `result`. No `return`, no data.
- **Read the page before acting.** `return await page._snapshotForAI()` gives a compact, model-friendly view of the current page — prefer it over dumping raw HTML.
- **Binary doesn't serialize.** Screenshots and downloads come back `undefined` through `browser_execute`. Capture a screenshot with `kernel.browsers.computer.captureScreenshot(session_id)` and read files with `kernel.browsers.filesystem.readFile(session_id, { path })` — add those as their own tools if the agent needs them.
- **Prefer resilient selectors** — roles and visible text over brittle CSS chains.
- **Keep snippets small.** One action or one read per call is easier for the model to reason about than a long script.

## Sessions and durability

A Kernel browser is a persistent session keyed by `session_id`, and eve turns are durable. Store the `session_id` the agent is working with (in session state or a sandbox file) and reuse it — don't create a browser per step. When a browser goes idle, Kernel snapshots its full state (cookies, DOM, storage) and restores it in milliseconds on the next call, so a session survives long pauses between eve turns. Raise `timeout_seconds` on `create_browser` for tasks with long gaps.

## Human-in-the-loop via live view

`create_browser` returns `live_view_url` — an interactive, real-time view of the browser. Pair it with eve's HITL approvals: when the agent hits a login wall, a CAPTCHA it shouldn't solve, or a decision only a person should make, surface the live view URL and pause the turn. A human acts in the *same* browser, and because the eve session is durable, the agent resumes exactly where it left off. Through the Slack channel (see `examples/channels/slack.ts`), HITL prompts render as buttons, so the link and the "done" confirmation land where your team already works.

## Stealth, proxies, and logins

- **Stealth** — pass `stealth: true`. To tune it against a specific site or identify the anti-bot vendor, use the `profile-website-bot-detection` skill.
- **Proxies** — create a proxy in Kernel and pass its `proxy_id`. Stealth and a proxy compose.
- **Logins** — don't put credentials in code. Create a Kernel profile (an auth flow that saves cookies), then pass its name as `profile_name`. The `kernel-auth` skill covers managed auth, profiles, and reauthentication end to end.

## Setup

```bash
# In your eve project
npm install @onkernel/sdk

# Set your Kernel API key (get one at https://www.kernel.sh)
export KERNEL_API_KEY=<api-key>
```

Then copy the tools from [`examples/tools/`](./examples/tools) into `agent/tools/`. The default eve HTTP channel works immediately — `POST /eve/v1/session` and ask it to visit a page. For Slack, follow `examples/channels/slack.ts`.

## Related Kernel skills

This skill is the eve-specific orchestration layer; it leans on the rest of the Kernel skill set rather than duplicating it. Install any of them with `npx skills add kernel/skills`:

- **kernel-auth** — set up and reuse logins (profiles, managed auth) so `profile_name` works.
- **profile-website-bot-detection** — measure and tune stealth for a specific target.
- **kernel-typescript-sdk** — the full SDK surface (computer use, filesystem, pools, replays) when you need more than the three tools here.
- **kernel-cli** — drive and debug the same browsers from the command line.

## References

- **Eve** — https://vercel.com/eve · [Concepts](https://vercel.com/docs/eve/concepts) · [Tools](https://vercel.com/kb/guide/how-to-add-eve-tools)
- **Kernel docs** — https://www.kernel.sh/docs
- **Playwright execution** — https://www.kernel.sh/docs/browsers/playwright-execution
- **Live view** — https://www.kernel.sh/docs/browsers/live-view
