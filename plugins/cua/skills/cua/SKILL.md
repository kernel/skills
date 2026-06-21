---
name: cua
description: Drive Kernel cua — the `cua` CLI for shell automation, or the @onkernel/cua-agent TypeScript library for building your own computer-use agents. Use when opening URLs, clicking/typing/observing in a real cloud browser via cua, chaining multi-step browser tasks across shell calls, or wiring up `CuaAgent` / `CuaAgentHarness` against a Kernel browser. Covers model selection (gpt-5.5, claude-opus-4-7, gemini-3-flash-preview, n1.5-latest), named sessions, profile persistence, transcripts, live-view handoff, and Playwright escape hatches.
---

# cua

`cua` is a computer-use loop for Kernel cloud browsers. There are two surfaces, both backed by the same execution layer:

- **`cua` CLI** (`@onkernel/cua-cli`) — single binary that drives a real Chrome session running in Kernel. Each subcommand returns a one-line result on stdout and a deterministic exit code, so shell agents can chain calls.
- **`@onkernel/cua-agent` library** — `CuaAgent` / `CuaAgentHarness` TypeScript classes that run the same prompt → screenshot → tool-call loop against a Kernel browser, callable from your own code.

Both translate per-provider computer-use tool calls (OpenAI's `computer`, Anthropic's `computer_20251124`, Gemini's normalized-coordinate functions, Yutori Navigator's browser actions) into Kernel SDK `browsers.computer.*` calls and feed a fresh screenshot back to the model on every turn.

## When to use this skill

- **Use the CLI** when you need shell-callable computer-use steps (`cua open`, `cua click`, `cua do …`) or an interactive TUI. Best for ad-hoc agent tasks, shell pipelines, and one-shot prompts.
- **Use the library** when you need to embed cua inside a larger TS app, run a custom session repo, add your own pi tools alongside computer use, or react to per-event streams programmatically.
- **Reach for `kernel-agent-browser` instead** when you need deterministic browser scripting (semantic selectors, `find role`, `wait --text`, snapshots/refs). cua drives by screenshots; agent-browser drives by accessibility tree.
- **Reach for `kernel-typescript-sdk` instead** for raw Playwright/CDP control over a Kernel browser without an LLM in the loop.

## Prerequisites

- A Kernel account and API key (`KERNEL_API_KEY`). See the [`kernel-cli`](https://www.kernel.sh/docs) skill for install + auth.
- At least one model-provider API key, matched to the model you pick (table in "Model selection" below).
- Node 20+ for both the CLI install and the library.

## Install

### CLI

```bash
# Global install — gives you the `cua` binary on $PATH
npm i -g @onkernel/cua-cli

# Or zero-install one-shot
npx -y -p @onkernel/cua-cli cua --help
```

### Library

```bash
npm i @onkernel/cua-agent @onkernel/cua-ai @onkernel/sdk
```

## Environment variables

| Env | Used for |
| --- | --- |
| `KERNEL_API_KEY` | Kernel API key (always required) |
| `OPENAI_API_KEY` | OpenAI models (`-m openai:…`) |
| `ANTHROPIC_API_KEY` | Anthropic models (`-m anthropic:…`); `ANTHROPIC_OAUTH_TOKEN` also works |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Google / Gemini models (`-m google:…`) |
| `YUTORI_API_KEY` | Yutori Navigator (`-m yutori:…`) |
| `TZAFON_API_KEY` | Tzafon (`-m tzafon:…`) |
| `KERNEL_BASE_URL` | Override Kernel base URL |
| `XDG_DATA_HOME` | CLI sessions/transcripts dir (defaults to `~/.local/share`) |
| `CUA_IMAGE_PROTOCOL` | Force inline image protocol (`kitty` / `iterm2` / `none` / `auto`) |

The library auto-loads these via `getCuaEnvApiKey` if you don't pass explicit auth callbacks.

## CLI: one-shot subcommands

Each call provisions a fresh Kernel browser by default, runs the action, prints a one-line result, and tears the browser down. Chain via `-s <name>` (next section) to keep state.

| Subcommand | What it does | Stdout | Exit code |
| --- | --- | --- | --- |
| `cua open <url>` | Navigate to a URL. | `ok` | 0 ok, 2 error |
| `cua click "<desc>"` | Find element matching natural-language description and click it. | `ok clicked (x, y)` or `not_found <reason>` | 0 ok, 1 not_found, 2 error |
| `cua type "<field>" "<text>"` | Focus a field by description and type. | `ok typed` or `not_found <reason>` | 0 ok, 1 not_found, 2 error |
| `cua press <key> [<key>...]` | Send a key combo (`cua press ctrl l`, `cua press Return`). | `ok pressed` | 0 ok, 2 error |
| `cua url` | Print the current URL. | the URL | 0 ok, 2 error |
| `cua observe ["<question>"]` | Describe the page; optionally answer a question. | the description | 0 ok, 2 error |
| `cua screenshot --out <file\|->` | Save a PNG. `--out -` writes bytes to stdout. | the path or `(stdout)` | 0 ok, 2 error |
| `cua do "<instruction>"` | Open-ended; agent plans and acts. Bound by `--max-steps` (default 3). | the assistant's final text | 0 ok, 2 error |

Useful flags:

- `-m <model>` — pick the LLM (default `openai:gpt-5.5`). `cua models` to list.
- `--max-steps <n>` — bound the loop on `cua do`.
- `--profile <id-or-name>` — load a Kernel browser profile for persisted cookies / storage. Existing ids or names are reused; a non-id name is created if missing. Pass `--profile-no-save-changes` for read-only.
- `-v` — verbose progress on stderr (provisioning, tool calls, transcript path).

`click` and `type` match **semantically**, not by selector — use natural-language descriptions of what's visible on screen.

## CLI: named sessions

Without `-s`, each subcommand provisions a brand-new browser. To keep state (cookies, URL, scroll position) across calls, allocate a named session first:

```bash
cua --profile github session start login    # provisions a Kernel browser, prints `name=login`
cua -s login open https://github.com/login
cua -s login type "email field"    "$EMAIL"
cua -s login type "password field" "$PASSWORD"
cua -s login click "Sign in"
cua -s login url                            # prints post-login URL
cua session stop login                      # tears down the Kernel browser
```

Inspect:

```bash
cua session list                            # NAME / KERNEL_ID / AGE / LIVE_URL
cua session show login                      # full JSON metadata
```

Pass `--profile` when starting the named session; later `cua -s <name> …` calls attach to the same browser, so they don't need the profile flag.

**Liveness**: Kernel browsers time out from inactivity. If you see `error session "<name>" is no longer alive on Kernel …`, run `cua session stop <name> && cua --profile <same-profile-as-before> session start <name>` to re-provision with the same persisted profile.

Named-session metadata lives in `$XDG_DATA_HOME/cua/named-sessions/<name>.json`.

## CLI: free-form mode

```bash
cua --print "open hn and tell me the top story"   # one-shot, streams text
cua --print -o jsonl "..."                        # one-shot, streams JSONL events
cua "..."                                         # interactive TUI (real terminal)
```

`--print` exits when the agent finishes; the TUI runs until Ctrl+C. Add `--jsonl-include-deltas` for token deltas, `--jsonl-include-images` for base64 screenshots in `tool_result` events.

## Library: quick start with `CuaAgentHarness`

The harness is the recommended entry point. It owns the session, persists every turn, handles steering / follow-up, and can swap providers mid-conversation.

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

While a turn is running: `steer()` injects course corrections, `followUp()` queues the next instruction, `subscribe()` streams underlying agent events, and `compact()` collapses long transcripts.

### When to use `CuaAgent` instead

Reach for `CuaAgent` (extends pi `Agent`) when you want raw control — direct `state.messages` access, custom streaming, explicit prompt/continue/queue, no session repo. The shape is the same except you assign `agent.state.model = …` instead of calling `setModel()`.

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

### CLI vs library vs raw `CuaAgent`

| You want to … | Use |
| --- | --- |
| Drive cua from shell scripts | CLI |
| Open-ended TUI session | CLI (`cua` no args) |
| Embed cua inside a TS app with session-backed turns | `CuaAgentHarness` |
| Add your own pi tools alongside computer use | `CuaAgentHarness` (`extraTools`) or `CuaAgent` |
| Raw pi `Agent` semantics: own message state, lifecycle events | `CuaAgent` |

## Model selection

Run `cua models` (or `listCuaModels()` from `@onkernel/cua-ai`) for the current catalog. As of writing, the four supported providers and their built-in computer-use vocabularies:

| Model ref | Provider | Notes |
| --- | --- | --- |
| `openai:gpt-5.5` | OpenAI | Built-in `computer` tool; default in CLI. |
| `anthropic:claude-opus-4-7` | Anthropic | Built-in `computer_20251124` tool. Supports `--thinking` levels. |
| `google:gemini-3-flash-preview` | Google | Predefined computer-use functions with 0–1000 normalized coords. |
| `yutori:n1.5-latest` | Yutori | OpenAI-compatible chat with browser action tool calls. |

Switching models mid-turn:

- CLI: re-run with `-m <ref>`, or attach a `-s` named session with a different `-m` per call.
- Library (harness): `await harness.setModel("anthropic:claude-opus-4-7")` — CUA tools and the default system prompt refresh.
- Library (agent): assign `agent.state.model = "anthropic:claude-opus-4-7"`.

Not every provider's native vocabulary includes navigation. Pass `computerUseExtra: true` to add the provider-neutral `computer_use_extra` tool (`goto`, `back`, `forward`, `url`) when you need it on a model that lacks built-in navigation.

## Browser config

The CLI always provisions stealth-on browsers and exposes profile persistence via `--profile` / `--profile-no-save-changes`. For any other browser knob — non-stealth, custom viewport, proxy, custom timeout — use the library and provision the browser yourself:

```ts
const browser = await client.browsers.create({
  stealth: true,           // CLI hardcodes this on; flip to false only via the library
  headless: false,         // headful => live view URL; headless => no live view, smaller image
  timeout: 1800,           // seconds before the Kernel browser auto-times-out
  profile: { name: "github", save_changes: true },  // load + save persisted state
  // proxy: { ... },        // optional outbound proxy
});
```

If you need a custom-provisioned browser from the CLI, pre-create it with `kernel browsers create` and attach via `cua session …` — see the kernel-cli skill for the create flag reference.

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

Use `createCuaComputerTools()` directly if you want to compose the tool list yourself (e.g. wrap computer-use tools in a permission gate):

```ts
import { resolveCuaRuntimeSpec } from "@onkernel/cua-ai";
import { createCuaComputerTools } from "@onkernel/cua-agent";

const runtime = resolveCuaRuntimeSpec("openai:gpt-5.5");
const tools = [
  ...createCuaComputerTools({ browser, client, toolExecutors: runtime.toolExecutors }),
  lookupOrder,
];
```

## Live view URL and manual login fallback

cua's `--profile` (CLI) and `profile` (library) handle most login persistence, but stealth doesn't always beat bot detection. When automation gets stuck on a login, hand off to a human via the live view URL.

### CLI

```bash
cua --profile mysite session start login
cua session show login | jq -r .live_url   # share this URL with the user
# user logs in manually in their browser via the live view
cua -s login url                           # confirm the post-login URL
cua session stop login                     # profile state saves on teardown
```

### Library

Every Kernel browser response carries the live view URL on creation:

```ts
const browser = await client.browsers.create({ stealth: true, headless: false });
console.log("live view:", browser.browser_live_view_url);
// share that URL, wait for the user to finish manual login, then prompt the agent
```

If you only have a session id, fetch it:

```bash
kernel browsers view <session-id>
```

## Cross-origin iframes / Playwright escape hatch

cua drives by clicking pixels, so cross-origin iframes (payment forms, embedded vendor widgets) work in the screenshot flow without special handling — the model just clicks them. When you need a deterministic Playwright action against the underlying browser (e.g. to fill a card form via a fixed selector), break out to Kernel's exec endpoint with the session id:

```bash
# CLI: find the session id
cua session show login | jq -r .kernel_session_id

# Run a Playwright snippet against the same browser
kernel browsers exec <session-id> --code "
  const frame = page.frameLocator('#payment-iframe');
  await frame.locator('#card-number').fill('4111111111111111');
  await frame.locator('#submit').click();
"
```

From the library, you already have `browser.session_id` and the Kernel client — call the same exec endpoint via the SDK.

## Debugging

- **CLI verbose**: `cua -v --print "…"` writes provisioning info, tool calls, and the transcript path to stderr.
- **Live event stream**: `cua --print -o jsonl "…"` emits one event per line (`tool_call`, `tool_result`, `assistant_text_done`, etc.). Add `--jsonl-include-images` to inline screenshots in `tool_result`.
- **Persisted transcript**: every `--print`, TUI, and `-s <name>` invocation appends to `$XDG_DATA_HOME/cua/sessions/<cwd-hash>/<id>.jsonl`. Exact path:
  ```bash
  cua -v --print "..."                       # stderr includes: [cua] session=<path>
  cua session show login | jq -r .transcript_path
  ```
  Roles: `user`, `assistant`, `toolResult`. There's also a custom `cua-browser` entry written once per session with `kernel_session_id` / `live_url` / `profile_id`.
- **Library event subscription**:
  ```ts
  harness.subscribe((event) => {
    // event.type === "tool_call" | "tool_result" | "assistant_text_done" | ...
  });
  ```
- **Screenshots**: `cua screenshot --out shot.png` (CLI) or inspect the `image` blocks in `toolResult` transcript entries.
- **Page URL**: `cua url` to confirm post-action navigation. `agent.state.messages` (library) holds the full message history.

A couple of `jq` starters against a transcript path:

```bash
# Every tool call the agent made, in order
jq -c 'select(.role == "assistant") | .content[]?
       | select(.type == "tool_use") | {name, input}' "$TRANSCRIPT"

# Final assistant text (the answer)
jq -r 'select(.role == "assistant") | .content[]?
       | select(.type == "text") | .text' "$TRANSCRIPT" | tail -1
```

## Gotchas

- **Element descriptions are semantic, not selectors.** `cua click "Sign in button"` looks at the screenshot — describe what the user sees, not a CSS selector.
- **Viewport defaults to 1920x1080.** Resize via `client.browsers.create({ ... })` flags if you need something else.
- **Keyboard navigation > mouse-wheel scroll.** `cua press Page_Down` / `Home` / arrow keys is more reliable than scroll wheel via the LLM.
- **Multi-step state requires `-s` (CLI) or a session-backed harness (library).** A second one-shot subcommand can't see what the first one did.
- **Profile saves on close, not continuously.** Tear down cleanly (`cua session stop`, `client.browsers.deleteByID`) or you'll lose recent state.
- **Provider tool vocab gaps.** If a model can click and type but can't navigate, set `computerUseExtra: true` (library) or pick a different model.
- **`--max-steps` defaults to 3 on `cua do`.** Bump it for non-trivial tasks.

## Quick reference

```bash
# CLI quickstart — one-shot, fresh browser
cua --print "open hn and tell me the top story"

# CLI — named session for multi-step
cua --profile mysite session start work
cua -s work open https://example.com
cua -s work click "Log in"
cua -s work type "email field" "$EMAIL"
cua -s work click "Submit"
cua -s work url
cua session stop work

# CLI — list models, switch model per call
cua models
cua --print -m anthropic:claude-opus-4-7 "..."

# Get the live view URL
cua session show work | jq -r .live_url
kernel browsers view <session-id>   # alternative
```

```ts
// Library — minimal harness
import { CuaAgentHarness, InMemorySessionRepo, NodeExecutionEnv } from "@onkernel/cua-agent";

const session = await new InMemorySessionRepo().create({ id: "main" });
const harness = new CuaAgentHarness({
  browser, client, session,
  env: new NodeExecutionEnv({ cwd: process.cwd() }),
  model: "openai:gpt-5.5",
});
const result = await harness.prompt("Open example.com and click the first link.");
```
