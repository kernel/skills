---
name: kernel-browser-harness
description: Best practices for using browser-use's open-source browser-harness with Kernel cloud browsers over CDP. Use when driving a Kernel browser from browser-harness, extracting a CDP URL from `kernel browsers create`, persisting state across harness calls, or recording replays around a harness session.
---

# Browser-Harness with Kernel Cloud Browsers

This skill documents how to drive a Kernel cloud browser with [`browser-harness`](https://github.com/browser-use/browser-harness) (browser-use's open-source CDP harness). `browser-harness` already supports any CDP endpoint via the `BU_CDP_WS` env var — the work this skill covers is extracting that URL from the Kernel CLI, choosing the right `kernel browsers create` flags, and wiring teardown.

## When to Use This Skill

Use this skill when you need to:

- **Drive a Kernel browser from `browser-harness`** instead of the user's local Chrome
- **Extract a CDP URL** from `kernel browsers create -o json` to feed into `BU_CDP_WS`
- **Span multiple harness calls** across a long task (mint, drive, inspect, drive more, tear down)
- **Record a replay** around a harness session for review or sharing
- **Run parallel `browser-harness` sessions** against multiple Kernel browsers
- **Recover a session ID** from the harness workspace or `kernel browsers list` after losing local shell state

## Prerequisites

- Load the `kernel-cli` skill for Kernel CLI installation and authentication.
- Install `browser-harness` per its [setup-prompt](https://github.com/browser-use/browser-harness#setup-prompt). If your agent uses Claude Code or Codex, paste that prompt into the same session before using this skill — it installs the harness binary and registers `browser-harness`'s own `SKILL.md` (helper library, heredoc form, interaction skills, daemon model).
- Install `jq` (used to pull fields from the CLI's `-o json` output).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **Required** unless `kernel login` was run. Used by the CLI to mint sessions. | (none) |
| `BU_CDP_WS` | CDP WebSocket URL `browser-harness` connects to. Set on the **first** call only — the daemon caches the connection for subsequent calls under the same `BU_NAME`. | (local Chrome discovery) |
| `BU_NAME` | Namespaces the harness daemon socket. Use a fresh name per concurrent Kernel session and so this run doesn't collide with a local-Chrome harness daemon. | `default` |

## Basic Usage

Mint a Kernel browser, extract `cdp_ws_url`, set `BU_CDP_WS`, then invoke `browser-harness`:

```bash
SESSION=$(kernel browsers create --stealth -o json)
SESSION_ID=$(echo "$SESSION" | jq -r '.session_id')
export BU_CDP_WS=$(echo "$SESSION" | jq -r '.cdp_ws_url')
echo "live view: $(echo "$SESSION" | jq -r '.browser_live_view_url')"

BU_NAME=kernel browser-harness <<'PY'
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

## Multi-Step Usage (Persist the SID in the Harness Workspace)

For tasks that span more than one shell call — mint, drive, inspect, drive more, tear down — two things make this painless:

1. The `browser-harness` daemon (addressed by `BU_NAME`) holds the CDP connection between invocations, so `BU_CDP_WS` only needs to be set on the **first** call.
2. The harness's editable workspace (`agent-workspace/agent_helpers.py`) is reloaded on every heredoc, so any Python constant you write there is automatically in scope for subsequent calls.

Stash the session ID as a workspace constant on mint, then reference it directly from any heredoc:

```bash
# mint
SESSION=$(kernel browsers create --stealth --timeout 1800 -o json)
SID=$(echo "$SESSION" | jq -r '.session_id')
export BU_CDP_WS=$(echo "$SESSION" | jq -r '.cdp_ws_url')
echo "live view: $(echo "$SESSION" | jq -r '.browser_live_view_url')"
echo "KERNEL_SESSION_ID = \"$SID\"" >> agent-workspace/agent_helpers.py

# first call: daemon starts, workspace loads — KERNEL_SESSION_ID now available in every heredoc
BU_NAME=kernel browser-harness <<'PY'
new_tab("https://news.ycombinator.com")
print("session:", KERNEL_SESSION_ID, "title:", page_info()["title"])
PY

# later harness calls — no BU_CDP_WS needed, KERNEL_SESSION_ID still available
BU_NAME=kernel browser-harness <<'PY'
print(js("document.querySelector('.titleline a').textContent"))
PY

# teardown — `kernel-cli` skill handles the delete
kernel browsers delete "$SID"
sed -i '/^KERNEL_SESSION_ID = /d' agent-workspace/agent_helpers.py
```

The workspace path is wherever `browser-harness` was installed — see the harness's install.md for the default location. `BH_AGENT_WORKSPACE` overrides it.

Edits to `agent_helpers.py` are picked up by the next heredoc with no `--reload` needed (verified).

### Fallback: a known-path file (no harness workspace)

If you're driving the harness without an editable workspace (e.g. a non-Claude/Codex agent, or a plain shell script), persist the SID in a known file instead:

```bash
echo "$SID" > /tmp/kernel-sid
# ... later ...
kernel browsers delete "$(cat /tmp/kernel-sid)"
```

If the SID file gets lost, `kernel browsers list -o json | jq` recovers it.

## Recording

Replay recordings have their own lifecycle — wrap the harness call between `replays start` and `replays stop`, then `replays download`:

```bash
REPLAY=$(kernel browsers replays start "$SESSION_ID" -o json)
REPLAY_ID=$(echo "$REPLAY" | jq -r '.replay_id')

BU_NAME=kernel browser-harness <<'PY'
new_tab("https://example.com"); print(page_info()["title"])
PY

kernel browsers replays stop     "$SESSION_ID" "$REPLAY_ID"
kernel browsers replays download "$SESSION_ID" "$REPLAY_ID" -f ./replay.mp4
```

Pass `--framerate FPS` to `replays start` if you need a higher capture rate. The replay-view URL in the `start` response is a hosted player — open it in a browser tab if you don't need a local file.

## Parallel Sessions

Each parallel Kernel browser needs its own session and its own `BU_NAME` so daemon sockets don't collide:

```bash
SA=$(kernel browsers create --stealth -o json)
SB=$(kernel browsers create --stealth -o json)
SID_A=$(jq -r '.session_id' <<<"$SA"); CDP_A=$(jq -r '.cdp_ws_url' <<<"$SA")
SID_B=$(jq -r '.session_id' <<<"$SB"); CDP_B=$(jq -r '.cdp_ws_url' <<<"$SB")

BU_NAME=a BU_CDP_WS="$CDP_A" browser-harness <<'PY'
new_tab("https://news.ycombinator.com"); print(page_info()["title"])
PY
BU_NAME=b BU_CDP_WS="$CDP_B" browser-harness <<'PY'
new_tab("https://example.com"); print(page_info()["title"])
PY

kernel browsers delete "$SID_A" "$SID_B"
```

## Common Gotchas

1. **`BU_CDP_WS unreachable` mid-task**: the Kernel session probably hit its idle timeout. Default is 60s — pass `--timeout 1800` (or whatever fits the task) at create time.

2. **CDP URL is a JWT-signed `wss://`** endpoint — paste it directly into `BU_CDP_WS`, no rewriting or stripping.

3. **Daemon won't pick up a new session**: if you mint a new Kernel browser but reuse a `BU_NAME` whose daemon is still alive, the daemon stays connected to the old CDP URL. Run `browser-harness --reload` (stops the daemon so the next call connects fresh) or use a different `BU_NAME`.

4. **Live view URL is for the human**: print `browser_live_view_url` from the create response so the user can watch. The agent only needs `cdp_ws_url`.

5. **Always tear down**: `kernel browsers delete "$SESSION_ID"` when the task ends. Sessions bill until idle timeout. If you lost the SID, read it from `agent_helpers.py` (`KERNEL_SESSION_ID`) or recover it with `kernel browsers list -o json | jq`.

6. **Skill responsibilities**: `browser-harness`'s `SKILL.md` owns helper usage (`new_tab`, `page_info`, `js`, …) and the heredoc form. The `kernel-cli` skill owns `kernel browsers create / list / get / delete` and `replays` lifecycle. This skill only owns the CLI-to-harness wiring.

## Quick Reference

```bash
# Mint + stash SID in workspace
SESSION=$(kernel browsers create --stealth --timeout 1800 -o json)
SID=$(echo "$SESSION" | jq -r '.session_id')
export BU_CDP_WS=$(echo "$SESSION" | jq -r '.cdp_ws_url')
echo "live view: $(echo "$SESSION" | jq -r '.browser_live_view_url')"
echo "KERNEL_SESSION_ID = \"$SID\"" >> agent-workspace/agent_helpers.py

# First harness call — daemon starts, workspace loads KERNEL_SESSION_ID
BU_NAME=kernel browser-harness <<'PY'
new_tab("https://example.com"); print("sid:", KERNEL_SESSION_ID, page_info())
PY

# Later harness calls — no BU_CDP_WS, KERNEL_SESSION_ID still available from workspace
BU_NAME=kernel browser-harness <<'PY'
print(js("document.title"))
PY

# Recovery if you lost the SID
kernel browsers list -o json | jq

# Teardown
kernel browsers delete "$SID"
sed -i '/^KERNEL_SESSION_ID = /d' agent-workspace/agent_helpers.py
```
