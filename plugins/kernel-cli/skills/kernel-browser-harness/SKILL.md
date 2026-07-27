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
- If `browser-harness` is not already on `$PATH`, install it per its [setup-prompt](https://github.com/browser-use/browser-harness#setup-prompt). If it is already installed, **do not reinstall or run setup prompts** — go straight to minting the Kernel browser.
- Install `jq` only if missing (used to pull fields from the CLI's `-o json` output).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **Required** unless `kernel login` was run. Used by the CLI to mint sessions. | (none) |
| `BU_CDP_WS` | CDP WebSocket URL `browser-harness` connects to. Set on the **first** call only — the daemon caches the connection for subsequent calls under the same `BU_NAME`. | (local Chrome discovery) |
| `BU_NAME` | Namespaces the harness daemon socket. **Use the Kernel session ID** (`BU_NAME=$SESSION_ID`) — collision-proof per session, no extra naming convention to remember. | `default` |

## Basic Usage

Fast path: create **exactly one** Kernel browser, save its raw JSON response in a private, unique temporary file, and derive every value from that file. Treat `cdp_ws_url` as a credential: do not log it or copy it between tasks.

Run this as one Bash script so the `EXIT` trap cleans up after success, failure, or interruption:

```bash
set -euo pipefail

SESSION_FILE=$(mktemp "${TMPDIR:-/tmp}/kernel-browser-harness.XXXXXX.json")
SESSION_ID=
cleanup() {
  if [ -n "$SESSION_ID" ]; then
    BU_NAME="$SESSION_ID" browser-harness --reload >/dev/null 2>&1 || true
    kernel browsers delete "$SESSION_ID" || true
  fi
  rm -f "$SESSION_FILE"
}
trap cleanup EXIT

kernel browsers create --stealth --timeout 1800 -o json >"$SESSION_FILE"
SESSION_ID=$(jq -er '.session_id' "$SESSION_FILE")
CDP_WS=$(jq -er '.cdp_ws_url' "$SESSION_FILE")
echo "live view: $(jq -r '.browser_live_view_url // empty' "$SESSION_FILE")"

BU_NAME="$SESSION_ID" BU_CDP_WS="$CDP_WS" browser-harness <<'PY'
new_tab("https://news.ycombinator.com")
wait_for_load()
print(page_info())
PY
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

Default stealth proxy control is a runtime update, not a create flag. If a stealth session must connect directly, run this **before** the first harness call:

```bash
kernel browsers update "$SESSION_ID" --disable-default-proxy
```

Re-enable the default stealth proxy with `--disable-default-proxy=false`. Use `--proxy-id` or `--clear-proxy` instead when changing an explicitly configured proxy.

## Multi-Step Usage

For tasks that span more than one harness invocation — mint, drive, inspect, drive more, tear down — the daemon holds the CDP connection. Put every invocation before the owning script's `EXIT` trap runs; `BU_CDP_WS` is needed only on the **first** call for that `BU_NAME`.

With `BU_NAME=$SESSION_ID` as the convention, every subsequent harness call is just:

```bash
BU_NAME=$SESSION_ID browser-harness <<'PY'
print(js("document.title"))
PY
```

— and parallel sessions are automatic: each Kernel browser has a unique session ID, so two `BU_NAME=$SESSION_ID` invocations against different sessions never collide on the daemon socket.

If separate shell processes are unavoidable, let the parent orchestrator own the response file and final cleanup; a trap in a short-lived mint subprocess would delete the session too early. Reload `session_id` and `cdp_ws_url` from the saved JSON when variables are lost. If the file is gone, inspect active sessions with `kernel browsers list --limit 100 -o json | jq`; use `--offset` for additional pages and identify the exact session before continuing or deleting anything.

For replay recording around a harness session, see the `kernel-cli` skill's replays reference.

## Parallel Sessions

Create one Kernel browser per worker and keep each worker's response file, session ID, CDP URL, and daemon name together. Never share a response file or `BU_NAME` between workers. Register each session with parent cleanup as soon as its create succeeds:

```bash
set -euo pipefail
declare -a SESSION_IDS=() SESSION_FILES=()

cleanup_parallel() {
  for sid in "${SESSION_IDS[@]}"; do
    BU_NAME="$sid" browser-harness --reload >/dev/null 2>&1 || true
    kernel browsers delete "$sid" || true
  done
  rm -f "${SESSION_FILES[@]}"
}
trap cleanup_parallel EXIT

mint() {
  local sid_var=$1 cdp_var=$2 file_var=$3 file sid cdp
  file=$(mktemp "${TMPDIR:-/tmp}/kernel-browser-harness.XXXXXX.json")
  SESSION_FILES+=("$file")
  kernel browsers create --stealth --timeout 1800 -o json >"$file"
  sid=$(jq -er '.session_id' "$file")
  SESSION_IDS+=("$sid")
  cdp=$(jq -er '.cdp_ws_url' "$file")
  printf -v "$sid_var" '%s' "$sid"
  printf -v "$cdp_var" '%s' "$cdp"
  printf -v "$file_var" '%s' "$file"
}

mint SESSION_A CDP_A FILE_A
mint SESSION_B CDP_B FILE_B

BU_NAME="$SESSION_A" BU_CDP_WS="$CDP_A" browser-harness <<'PY' &
new_tab("https://example.com"); wait_for_load(); print(page_info())
PY
PID_A=$!

BU_NAME="$SESSION_B" BU_CDP_WS="$CDP_B" browser-harness <<'PY' &
new_tab("https://example.org"); wait_for_load(); print(page_info())
PY
PID_B=$!

wait "$PID_A" "$PID_B"
```

The trap stops each local daemon, deletes each billed Kernel session, and removes both response files. Do not rely on `wait` or the idle timeout for cleanup.

## Common Gotchas

1. **`BU_CDP_WS unreachable` mid-task**: the Kernel session probably hit its idle timeout. Default is 60s — pass `--timeout 1800` (or whatever fits the task) at create time.

2. **Keep URLs separated**: treat `cdp_ws_url` as an opaque secret and pass it directly into `BU_CDP_WS` without rewriting it. `browser_live_view_url` is only for the human observer.

3. **Daemon won't pick up a new session**: if you mint a new Kernel browser but reuse a stale `BU_NAME`, the daemon stays connected to the old CDP URL. Using `BU_NAME=$SESSION_ID` avoids this. Otherwise, run `BU_NAME=<name> browser-harness --reload` before connecting that name to a new endpoint.

4. **Extra creates waste time and leak money**: one task should usually call `kernel browsers create` once. Save and reuse its `-o json` response; never hardcode IDs or CDP URLs from a previous task.

5. **Always tear down both layers**: stop the named local daemon with `BU_NAME="$SESSION_ID" browser-harness --reload`, then run `kernel browsers delete "$SESSION_ID"` and remove the saved JSON file. `--reload` does not delete the Kernel browser; Kernel sessions bill until deletion or idle timeout. Put all three operations in an `EXIT` trap for scripts.

`browser-harness`'s skill owns helper usage (`new_tab`, `page_info`, `js`, and so on). The `kernel-cli` skill owns browser and replay lifecycles. Keep this skill limited to CLI-to-harness wiring.
