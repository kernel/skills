---
name: kernel-browser-harness
description: Best practices for using browser-use's open-source browser-harness with Kernel cloud browsers over CDP. Use when driving a Kernel browser from browser-harness, extracting a CDP URL from `kernel browsers create`, or running multi-step or parallel harness sessions against Kernel.
---

# Browser-Harness with Kernel Cloud Browsers

This skill documents how to drive a Kernel cloud browser with [`browser-harness`](https://github.com/browser-use/browser-harness) (browser-use's open-source CDP harness). `browser-harness` already supports any CDP endpoint via the `BU_CDP_WS` env var — the work this skill covers is extracting that URL from the Kernel CLI, picking the right `kernel browsers create` flags, and using the Kernel session ID as the harness daemon name so sessions don't collide.

## When to Use This Skill

Use this skill when you need to:

- **Drive a Kernel browser from `browser-harness`** instead of the user's local Chrome
- **Extract a CDP URL** from `kernel browsers create -o json` to feed into `BU_CDP_WS`
- **Span multiple harness calls** across a long task (mint, drive, inspect, drive more, tear down)
- **Run parallel harness sessions** against multiple Kernel browsers without socket collisions

## Prerequisites

- Load the `kernel-cli` skill for Kernel CLI installation and authentication.
- Install `browser-harness` per its [setup-prompt](https://github.com/browser-use/browser-harness#setup-prompt). If your agent uses Claude Code or Codex, paste that prompt into the same session before using this skill — it installs the harness binary and registers `browser-harness`'s own `SKILL.md` (helper library, heredoc form, interaction skills, daemon model).
- Install `jq` (used to pull fields from the CLI's `-o json` output).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **Required** unless `kernel login` was run. Used by the CLI to mint sessions. | (none) |
| `BU_CDP_WS` | CDP WebSocket URL `browser-harness` connects to. Set on the **first** call only — the daemon caches the connection for subsequent calls under the same `BU_NAME`. | (local Chrome discovery) |
| `BU_NAME` | Namespaces the harness daemon socket. **Use the Kernel session ID** (`BU_NAME=$SESSION_ID`) — collision-proof per session, no extra naming convention to remember. | `default` |

## Basic Usage

Mint a Kernel browser, extract `cdp_ws_url`, set `BU_CDP_WS`, then invoke `browser-harness` with the session ID as `BU_NAME`:

```bash
SESSION=$(kernel browsers create --stealth -o json)
SESSION_ID=$(echo "$SESSION" | jq -r '.session_id')
export BU_CDP_WS=$(echo "$SESSION" | jq -r '.cdp_ws_url')
echo "live view: $(echo "$SESSION" | jq -r '.browser_live_view_url')"

BU_NAME=$SESSION_ID browser-harness <<'PY'
new_tab("https://news.ycombinator.com")
wait_for_load()
print(page_info())
PY

kernel browsers delete "$SESSION_ID"
```

Kernel browsers boot **headful by default** — the create response includes `browser_live_view_url`. Print it so the user can watch the agent work, or pass `--headless` to opt out (no live view, smaller image).

### `kernel browsers create` flag picks

Common choices when minting a session for harness use:

| Flag | Use For |
|------|---------|
| `--stealth` (`-s`) | Bot-detection bypass — on for most public sites |
| `--headless` (`-H`) | Opt out of headful default — no live view, no VNC |
| `--profile-name NAME` | Reuse a saved Kernel profile (logged-in state, cookies, localStorage) |
| `--proxy-id ID` | Route through a Kernel-managed proxy (residential, regional, etc.) |
| `--timeout N` | Idle timeout in seconds (default 60, max 259200) — bump for long agent runs |
| `--start-url URL` | Open a URL when the session boots |
| `--save-changes` | Persist profile mutations back when the session ends |

See `kernel browsers create --help` for the full list.

## Multi-Step Usage

For tasks that span more than one shell call — mint, drive, inspect, drive more, tear down — the daemon does the work. `browser-harness` (addressed by `BU_NAME`) holds the CDP connection between invocations, so `BU_CDP_WS` only needs to be set on the **first** call.

With `BU_NAME=$SESSION_ID` as the convention, every subsequent harness call is just:

```bash
BU_NAME=$SESSION_ID browser-harness <<'PY'
print(js("document.title"))
PY
```

— and parallel sessions are automatic: each Kernel browser has a unique session ID, so two `BU_NAME=$SESSION_ID` invocations against different sessions never collide on the daemon socket.

If you lose `$SESSION_ID` across shell calls, recover it with `kernel browsers list -o json | jq`.

For replay recording around a harness session, see the `kernel-cli` skill's replays reference.

## Common Gotchas

1. **`BU_CDP_WS unreachable` mid-task**: the Kernel session probably hit its idle timeout. Default is 60s — pass `--timeout 1800` (or whatever fits the task) at create time.

2. **CDP URL is a JWT-signed `wss://`** endpoint — paste it directly into `BU_CDP_WS`, no rewriting or stripping.

3. **Daemon won't pick up a new session**: if you mint a new Kernel browser but reuse a stale `BU_NAME`, the daemon stays connected to the old CDP URL. Using `BU_NAME=$SESSION_ID` avoids this entirely (new session, new socket). If you do hit it manually, `browser-harness --reload` stops the daemon so the next call connects fresh.

4. **Live view URL is for the human**: print `browser_live_view_url` from the create response so the user can watch. The agent only needs `cdp_ws_url`.

5. **Always tear down**: `kernel browsers delete "$SESSION_ID"` when the task ends. Sessions bill until idle timeout. If you lost the SID, `kernel browsers list -o json | jq` recovers it.

6. **Skill responsibilities**: `browser-harness`'s `SKILL.md` owns helper usage (`new_tab`, `page_info`, `js`, …) and the heredoc form. The `kernel-cli` skill owns `kernel browsers create / list / get / delete` and `replays` lifecycle. This skill only owns the CLI-to-harness wiring.

## Quick Reference

```bash
# Mint
SESSION=$(kernel browsers create --stealth --timeout 1800 -o json)
SESSION_ID=$(echo "$SESSION" | jq -r '.session_id')
export BU_CDP_WS=$(echo "$SESSION" | jq -r '.cdp_ws_url')
echo "live view: $(echo "$SESSION" | jq -r '.browser_live_view_url')"

# Drive (any number of harness calls — only the first needs BU_CDP_WS)
BU_NAME=$SESSION_ID browser-harness <<'PY'
new_tab("https://example.com"); print(page_info())
PY

BU_NAME=$SESSION_ID browser-harness <<'PY'
print(js("document.title"))
PY

# Recovery if you lost the SID across shells
kernel browsers list -o json | jq

# Teardown
kernel browsers delete "$SESSION_ID"
```
