---
name: cua-agent
description: Build TypeScript apps that embed Kernel's computer-use loop with `@onkernel/cua-agent` — `CuaAgent` and `CuaAgentHarness` classes drive a Kernel cloud browser via prompt → screenshot → tool-call loops across OpenAI, Anthropic, Google, and Yutori provider tools. Use when writing TS code that needs computer-use against a Kernel browser, swapping providers mid-session, adding your own pi tools alongside computer use, or hooking into the agent event stream. For shell-callable cua, see `cua-cli`.
---

# cua-agent

`@onkernel/cua-agent` ships two TS classes for running a computer-use loop against a Kernel cloud browser:

- **`CuaAgentHarness`** — recommended entry point. Session-backed turns, `setModel` mid-conversation, steering / follow-up, `subscribe()` event stream. Extends pi-agent-core's `AgentHarness`.
- **`CuaAgent`** — lower-level. Direct `state.messages` access, custom streaming, explicit prompt/continue/queue. Extends pi-agent-core's `Agent`.

Both translate per-provider computer-use tool calls (OpenAI's `computer`, Anthropic's `computer_20251124`, Gemini's normalized-coordinate functions, Yutori Navigator's browser actions) into Kernel SDK `browsers.computer.*` calls and feed a fresh screenshot back to the model on every turn.

## When to use this skill

- **Use this skill** when writing TS code that embeds cua inside a larger app, needs a custom session repo, runs its own pi tools alongside computer use, or reacts to per-event streams programmatically.
- **Reach for the `cua-cli` skill** (in the `kernel-cli` plugin) when shell-callable computer-use is enough (`cua open`, `cua click`, `cua do`).
- **Reach for `kernel-typescript-sdk`** for raw Playwright / CDP control over a Kernel browser without an LLM in the loop.

## Prerequisites

- A Kernel account and `KERNEL_API_KEY`.
- At least one model-provider API key, matched to the model you pick (table below).
- Node 20+, TypeScript app or `tsx` runner.

## Install

```bash
npm i @onkernel/cua-agent @onkernel/cua-ai @onkernel/sdk
```

The three packages divide responsibility:

- `@onkernel/cua-agent` — `CuaAgent` / `CuaAgentHarness` execution loop.
- `@onkernel/cua-ai` — model catalog (`getCuaModel` / `listCuaModels`), canonical CUA tool schemas, per-provider adapters.
- `@onkernel/sdk` — Kernel SDK client used to provision the browser.

Both classes re-export the full pi-agent-core surface from `@onkernel/cua-agent`, including `NodeExecutionEnv` (via the `/node` subpath under the hood) and `InMemorySessionRepo`. Import them from `@onkernel/cua-agent` directly.

## Environment variables

If you don't pass explicit auth callbacks, both classes resolve provider keys via `@onkernel/cua-ai`'s `getCuaEnvApiKey`:

| Env | Used for |
| --- | --- |
| `KERNEL_API_KEY` | Kernel API key (always required) |
| `OPENAI_API_KEY` | `openai:…` models |
| `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH_TOKEN` | `anthropic:…` models |
| `GOOGLE_API_KEY` or `GEMINI_API_KEY` | `google:…` models |
| `YUTORI_API_KEY` | `yutori:…` models |
| `TZAFON_API_KEY` | `tzafon:…` models |

## Quick start — `CuaAgentHarness`

```ts
import Kernel from "@onkernel/sdk";
import {
  CuaAgentHarness,
  InMemorySessionRepo,
  NodeExecutionEnv,
} from "@onkernel/cua-agent";
import type { AssistantMessage } from "@onkernel/cua-ai";

const client = new Kernel({ apiKey: process.env.KERNEL_API_KEY! });
const browser = await client.browsers.create({ stealth: true });

const repo = new InMemorySessionRepo();
const session = await repo.create({ id: "research" });

const harness = new CuaAgentHarness({
  browser,
  client,
  env: new NodeExecutionEnv({ cwd: process.cwd() }),
  model: "openai:gpt-5.5",
  session,
});

const textOf = (m: AssistantMessage) =>
  m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();

const first = await harness.prompt("Open example.com and describe what you see.");
console.log(textOf(first));

// Swap providers mid-session — CUA tools and the default prompt refresh.
await harness.setModel("anthropic:claude-opus-4-7");
const second = await harness.prompt("Open the most relevant link from what you found.");
console.log(textOf(second));

await client.browsers.deleteByID(browser.session_id);
```

While a turn is running: `steer()` injects course corrections, `followUp()` queues the next instruction, `subscribe()` streams underlying agent events, and `compact()` collapses long transcripts. See [`@earendil-works/pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core) for the full harness lifecycle.

## `CuaAgent` for raw pi `Agent` semantics

Reach for `CuaAgent` when you want direct control — `state.messages` access, custom streaming, explicit prompt/continue/queue, no session repo. Same constructor shape except you assign `agent.state.model = …` instead of calling `setModel()`.

```ts
import { CuaAgent } from "@onkernel/cua-agent";

const agent = new CuaAgent({
  browser,
  client,
  initialState: {
    model: "openai:gpt-5.5",
    systemPrompt: "You are a careful browser automation agent.",
  },
});

agent.subscribe((event) => { /* … */ });
await agent.prompt("Open news.ycombinator.com and summarize the top story.");
```

### Harness vs Agent

| You want to … | Use |
| --- | --- |
| Session-backed turns persisted to a repo | `CuaAgentHarness` |
| Steering, follow-up queue, compaction, branching | `CuaAgentHarness` |
| `await setModel()` mid-conversation | `CuaAgentHarness` |
| Direct `state.messages` access, no session machinery | `CuaAgent` |
| Custom streaming + explicit `prompt`/`continue`/`queue` control | `CuaAgent` |

## Model selection and switching

Run `listCuaModels()` from `@onkernel/cua-ai` for the current catalog. Pass either a CUA model ref (e.g. `"openai:gpt-5.5"`) or a concrete pi `Model` — both shape-widen the same options field.

| Model ref | Provider | Notes |
| --- | --- | --- |
| `openai:gpt-5.5` | OpenAI | Built-in `computer` tool |
| `anthropic:claude-opus-4-7` | Anthropic | Built-in `computer_20251124` tool |
| `google:gemini-3-flash-preview` | Google | Predefined CU functions, 0–1000 normalized coords |
| `yutori:n1.5-latest` | Yutori | OpenAI-compatible chat with browser action tool calls |

Switching:

```ts
// Harness — async, updates via pi snapshot machinery
await harness.setModel("anthropic:claude-opus-4-7");

// Agent — direct assignment
agent.state.model = "anthropic:claude-opus-4-7";
```

In both cases CUA-owned tools and the default system prompt refresh for the next provider request.

Not every provider's native vocabulary includes navigation (`goto`, `back`, `forward`, `url`). Pass `computerUseExtra: true` to add the provider-neutral `computer_use_extra` tool when the model can click/type but can't navigate.

## Browser provisioning

You own the Kernel browser lifecycle — provision before constructing the agent, tear down after:

```ts
const browser = await client.browsers.create({
  stealth: true,           // bypass most fingerprinting; default off
  headless: false,         // headful => live view URL; headless => no live view, smaller image
  timeout: 1800,           // seconds before Kernel auto-times-out the browser
  profile: { name: "github", save_changes: true },
  // proxy: { ... },
});

try {
  // ... use browser with harness/agent ...
} finally {
  await client.browsers.deleteByID(browser.session_id);
}
```

The `browser.browser_live_view_url` field on the create response is the URL to share when you need a human to take over (manual login on a stealth-blocked site, captcha, etc.).

## Adding your own tools

Pass any pi `AgentTool` (see [`@earendil-works/pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core) for the tool shape) via `extraTools`. The CUA defaults stay installed; your tools run alongside them.

```ts
import type { AgentTool } from "@onkernel/cua-agent";
import { CuaAgentHarness } from "@onkernel/cua-agent";

const lookupOrder: AgentTool = {
  // shape per pi-agent-core docs: name, description, schema, run, ...
};

const harness = new CuaAgentHarness({
  browser, client,
  model: "openai:gpt-5.5",
  session,
  env: new NodeExecutionEnv({ cwd: process.cwd() }),
  extraTools: [lookupOrder],
  computerUseExtra: true,
});
```

If you want to compose the tool list yourself (e.g. wrap computer-use tools in a permission gate), reach for `createCuaComputerTools()`:

```ts
import { resolveCuaRuntimeSpec } from "@onkernel/cua-ai";
import { createCuaComputerTools } from "@onkernel/cua-agent";

const runtime = resolveCuaRuntimeSpec("openai:gpt-5.5");
const tools = [
  ...createCuaComputerTools({ browser, client, toolExecutors: runtime.toolExecutors }),
  lookupOrder,
];
```

## Manual login handoff via live view URL

Every Kernel browser response carries the live view URL on creation. When stealth doesn't beat bot detection, share that URL and wait for the human:

```ts
const browser = await client.browsers.create({
  stealth: true,
  headless: false,
  profile: { name: "mysite", save_changes: true },
});
console.log("share with user:", browser.browser_live_view_url);

// wait for user signal — e.g. a button, stdin, an HTTP callback —
// THEN start prompting the agent against the logged-in browser
await harness.prompt("Now click 'Settings' and read me the current value of X.");
```

Profile saves on browser teardown, so future runs with the same profile name skip the manual login.

## Cross-origin iframes / Playwright escape hatch

cua drives by clicking pixels, so cross-origin iframes work in the screenshot flow without special handling. When you need a deterministic Playwright action against the underlying browser (e.g. fill a card form via a fixed selector), drop to the Kernel SDK's exec endpoint with the session id you already have:

```ts
await client.browsers.exec(browser.session_id, {
  code: `
    const frame = page.frameLocator('#payment-iframe');
    await frame.locator('#card-number').fill('4111111111111111');
    await frame.locator('#submit').click();
  `,
});
```

## Debugging

- **`subscribe()`** — the harness and agent both stream pi-agent-core events. Use it to log tool calls, screenshot sizes, tokens:
  ```ts
  harness.subscribe((event) => {
    if (event.type === "tool_call") console.log("tool:", event.toolName);
    if (event.type === "assistant_text_done") console.log("text:", event.text);
  });
  ```
- **`agent.state.messages`** — full message history including image blocks (for `CuaAgent`). Inspect after a turn finishes.
- **Live view URL** — `browser.browser_live_view_url` lets you watch the agent work in real time, even headful.
- **Custom session repo** — implement pi-agent-core's `SessionRepo` interface to persist transcripts wherever you want (JSONL on disk, S3, a DB).

## Gotchas

- **You own the browser lifecycle.** Always tear down with `client.browsers.deleteByID(browser.session_id)` in a `finally` block — Kernel timeouts will reclaim eventually but profile state saves on close, not continuously.
- **`setModel` is async.** It propagates through pi's snapshot machinery — `await` it before the next `prompt()`.
- **Provider tool vocab gaps.** If a model can click and type but can't navigate, set `computerUseExtra: true` to add provider-neutral `goto` / `back` / `forward` / `url`.
- **`InMemorySessionRepo` is in-process only.** Reach for a persistent `SessionRepo` implementation if you need transcripts to survive restarts.
- **`extraTools` runs alongside CUA tools, not in place of them.** To replace the defaults, build the tool list with `createCuaComputerTools()` yourself.
- **Stealth, headless, viewport, proxy** are all `browsers.create` flags — set them when provisioning, not on the harness.

## Quick reference

```ts
import Kernel from "@onkernel/sdk";
import {
  CuaAgentHarness,
  InMemorySessionRepo,
  NodeExecutionEnv,
} from "@onkernel/cua-agent";

const client = new Kernel({ apiKey: process.env.KERNEL_API_KEY! });
const browser = await client.browsers.create({ stealth: true });

const session = await new InMemorySessionRepo().create({ id: "main" });

const harness = new CuaAgentHarness({
  browser, client, session,
  env: new NodeExecutionEnv({ cwd: process.cwd() }),
  model: "openai:gpt-5.5",
  computerUseExtra: true,
});

harness.subscribe((event) => { /* ... */ });

try {
  const first = await harness.prompt("Open example.com and click the first link.");
  await harness.setModel("anthropic:claude-opus-4-7");
  const second = await harness.prompt("Now extract the page title.");
} finally {
  await client.browsers.deleteByID(browser.session_id);
}
```
