---
name: cua-cli
description: Drive a Kernel cloud browser from the shell using the `cua` CLI. Use this skill when you need to open URLs, click elements, type into fields, take screenshots, or chain multi-step browser tasks across shell calls. Supports named sessions for stateful workflows, profile persistence for logins, transcript-based debugging, and live-view handoff when stealth fails. For building your own TS agent on top of cua, see `cua-agent`.
---

# cua-cli

`cua` is a single-binary CLI that drives a real Chrome session running in Kernel. It's designed for agentic use: each subcommand returns a one-line result on stdout and a deterministic exit code, so you can chain calls together and parse the output. An LLM picks targets semantically from screenshots — there are no CSS selectors.

## When to use this skill

- **Use this skill** when you need shell-callable computer-use steps (`cua open`, `cua click`, `cua do …`), an interactive TUI, or want to chain browser actions in a shell pipeline.
- **Reach for the `cua-agent` skill** (in the `kernel-sdks` plugin) when you're writing a TypeScript app that needs to embed cua's prompt → screenshot → tool-call loop programmatically.
- **Reach for `kernel-agent-browser`** when you need deterministic browser scripting (semantic selectors, `find role`, `wait --text`, accessibility-tree snapshots).
- **Reach for `kernel-cli`** for raw Kernel browser management (`kernel browsers create`, `kernel browsers exec`, profile / proxy CRUD).

## Prerequisites

- A Kernel account and `KERNEL_API_KEY`. See `kernel-cli` for install + auth.
- At least one model-provider API key, matched to the model you pick (table below).
- Node 20+ for the npm install.

## Install

```bash
# Global install — puts `cua` on $PATH
npm i -g @onkernel/cua-cli

# Or zero-install one-shot
npx -y -p @onkernel/cua-cli cua --help
```

## Environment variables

| Env | Used for |
| --- | --- |
| `KERNEL_API_KEY` | Kernel API key (always required) |
| `OPENAI_API_KEY` | OpenAI models (`-m openai:…`) |
| `ANTHROPIC_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` | Anthropic models (`-m anthropic:…`); OAuth token wins if both are set |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Google / Gemini models (`-m google:…`); `GOOGLE_API_KEY` wins if both are set |
| `YUTORI_API_KEY` | Yutori Navigator (`-m yutori:…`) |
| `TZAFON_API_KEY` | Tzafon (`-m tzafon:…`) |
| `KERNEL_BASE_URL` | Override Kernel base URL |
| `XDG_DATA_HOME` | Sessions / transcripts dir (defaults to `~/.local/share`) |
| `CUA_IMAGE_PROTOCOL` | Force inline image protocol (`kitty` / `iterm2` / `none` / `auto`) |

## One-shot subcommands

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

The cua CLI always provisions **stealth-on** browsers. If you need non-stealth or a custom viewport / proxy, pre-create the browser via `kernel browsers create` and attach the cua session to it.

If you're unsure of a flag or subcommand, `cua --help` and `cua <subcommand> --help` print the current surface.

## Named sessions

Without `-s`, each subcommand provisions a brand-new browser. To keep state across calls, allocate a named session first:

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

Pass `--profile` when starting the named session; later `cua -s <name> …` calls attach to the same browser, so they don't need the profile flag again.

**Liveness**: Kernel browsers time out from inactivity. If you see `error session "login" is no longer alive on Kernel …`, re-provision with the same profile and name:

```bash
cua session stop login                       # safe even if the Kernel browser is already gone
cua --profile github session start login     # re-attach name=login to a fresh browser, same profile
```

Named-session metadata lives in `$XDG_DATA_HOME/cua/named-sessions/<name>.json`.

## Free-form mode

```bash
cua --print "open hn and tell me the top story"   # one-shot, streams text
cua --print -o jsonl "..."                        # one-shot, streams JSONL events
cua "..."                                         # interactive TUI (real terminal)
```

`--print` exits when the agent finishes; the TUI runs until Ctrl+C. Add `--jsonl-include-deltas` for token deltas, `--jsonl-include-images` for base64 screenshots in `tool_result` events.

**If you're an agent driving cua from a shell, always pass `--print` or `--print -o jsonl`.** The bare `cua "..."` form opens an interactive TUI that needs a real terminal — it will hang in a non-interactive context.

## Model selection

Run `cua models` for the current catalog. Pick with `-m <ref>` (default `openai:gpt-5.5`). Switch per call or per named session.

| Model ref | Provider |
| --- | --- |
| `openai:gpt-5.5` | OpenAI (default) |
| `anthropic:claude-opus-4-7` | Anthropic (supports `--thinking off\|minimal\|low\|medium\|high\|xhigh`) |
| `google:gemini-3-flash-preview` | Google / Gemini |
| `yutori:n1.5-latest` | Yutori Navigator |

Not every provider's native vocabulary includes navigation. If a model can click and type but can't navigate (`goto`, `back`, `forward`, `url`), pick a different model.

## Live view URL and manual login fallback

Stealth-on doesn't always beat bot detection. When automation gets stuck on a login, hand off to a human via the live view URL.

```bash
cua --profile mysite session start login
cua session show login | jq -r .live_url   # share this URL with the user
# user logs in manually in the live view
cua -s login url                           # confirm post-login URL
cua session stop login                     # profile state saves on teardown
```

If you only have a session id (e.g. from `cua session list`), the `kernel` CLI also surfaces it:

```bash
kernel browsers view <session-id>
```

## Mixing vision and DOM (Playwright on the same browser)

cua's strength is semantic, vision-driven interaction — describe what's on screen, the model finds it. Playwright's strength is deterministic DOM access — exact selectors, structured data extraction, file uploads, network interception. Real workflows often need both, and the named-session model is built for it: every `cua -s <name>` session exposes a `kernel_session_id` that points at the same underlying Kernel browser, so you can interleave vision turns and Playwright snippets. State (URL, cookies, storage) is shared.

Reach for Playwright on the cua browser when:

- you need a **fixed selector** (form auto-fill, hidden inputs, file uploads, attribute reads).
- you want **structured extraction** (`page.$$eval` over a list) rather than asking the model to read pixels.
- you're driving a **cross-origin iframe** with a known DOM contract (payment widgets, SSO popups). cua can click iframes too, but Playwright gives you `frameLocator()` and structured assertions.
- you need to **wait on a network response or DOM condition** rather than a visual cue.

```bash
# Vision turns to get logged in and to the right page
cua --profile mysite session start login
cua -s login open https://example.com/checkout
cua -s login click "Continue to payment"

# Same browser, DOM-precise card fill
cua session show login | jq -r .kernel_session_id   # → <session-id>
kernel browsers exec <session-id> --code "
  const frame = page.frameLocator('#payment-iframe');
  await frame.locator('#card-number').fill(process.env.CARD_NUMBER);
  await frame.locator('#submit').click();
"

# Hand control back to vision for the confirmation flow
cua -s login observe "did the payment succeed?"
```

## Debugging

- **Verbose stderr**: `cua -v --print "…"` writes provisioning info, tool calls, and the transcript path to stderr.
- **Live event stream**: `cua --print -o jsonl "…"` emits one event per line (`tool_call`, `tool_result`, `assistant_text_done`, etc.). Add `--jsonl-include-images` to inline screenshots in `tool_result`.
- **Persisted transcript**: every `--print`, TUI, and `-s <name>` invocation appends to `$XDG_DATA_HOME/cua/sessions/<cwd-hash>/<id>.jsonl`. Find the exact path:
  ```bash
  cua -v --print "..."                       # stderr includes: [cua] session=<path>
  cua session show login | jq -r .transcript_path
  ```
  Roles: `user`, `assistant`, `toolResult`. There's also a custom `cua-browser` entry written once per session with `kernel_session_id` / `live_url` / `profile_id`.
- **Screenshots**: `cua screenshot --out shot.png` or inspect `image` blocks in `toolResult` transcript entries.
- **Page URL**: `cua url` to confirm post-action navigation.

A few `jq` starters against a transcript path:

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
- **Viewport defaults to 1920x1080.** Pre-create the browser with `kernel browsers create` if you need something else.
- **Keyboard navigation > mouse-wheel scroll.** `cua press Page_Down` / `Home` / arrow keys is more reliable than scroll wheel via the LLM.
- **Multi-step state requires `-s <name>`.** A second one-shot subcommand can't see what the first one did.
- **Profile saves on close, not continuously.** Tear down cleanly with `cua session stop` or you'll lose recent state.
- **`--max-steps` defaults to 3 on `cua do`.** Bump it for non-trivial tasks.

## Quick reference

```bash
# One-shot, fresh browser
cua --print "open hn and tell me the top story"

# Named session for multi-step
cua --profile github session start login
cua -s login open https://example.com
cua -s login click "Log in"
cua -s login type "email field" "$EMAIL"
cua -s login click "Submit"
cua -s login url
cua session stop login

# List models, switch model per call
cua models
cua --print -m anthropic:claude-opus-4-7 "..."

# Get the live view URL
cua session show login | jq -r .live_url
kernel browsers view <session-id>   # alternative

# Mix in a Playwright/DOM action against the same browser
cua session show login | jq -r .kernel_session_id
kernel browsers exec <session-id> --code "..."
```
