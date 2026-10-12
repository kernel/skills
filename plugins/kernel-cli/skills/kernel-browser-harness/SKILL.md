---
name: kernel-browser-harness
description: best practices for using browser-use's open-source browser-harness with KERNEL cloud browsers over cdp. use when driving a KERNEL browser from browser-harness, extracting a cdp url from `kernel browsers create`, or running multi-step or parallel harness sessions against KERNEL.
---

# Browser-Harness with Kernel Cloud Browsers

this skill documents how to drive a KERNEL cloud browser with [`browser-harness`](https://github.com/browser-use/browser-harness) (browser-use's open-source cdp harness). `browser-harness` already supports any cdp endpoint via the `BU_CDP_WS` env var — the work this skill covers is extracting that url from the KERNEL cli, picking the right `kernel browsers create` flags, and using the KERNEL session id as the harness daemon name so sessions don't collide.

## when to use this skill

use this skill when you need to:

- **drive a KERNEL browser from `browser-harness`** instead of the user's local Chrome
- **extract a cdp url** from `kernel browsers create -o json` to feed into `BU_CDP_WS`
- **span multiple harness calls** across a long task (mint, drive, inspect, drive more, tear down)
- **run parallel harness sessions** against multiple KERNEL browsers without socket collisions

## prerequisites

- load the `kernel-cli` skill for KERNEL cli installation and authentication.
- if `browser-harness` is not already on `$PATH`, install it per its [setup-prompt](https://github.com/browser-use/browser-harness#setup-prompt). if it is already installed, **do not reinstall or run setup prompts** — go straight to minting the KERNEL browser.
- install `jq` only if missing (used to pull fields from the cli's `-o json` output).

## environment variables

| variable | description | default |
|----------|-------------|---------|
| `KERNEL_API_KEY` | **required** unless `kernel login` was run. used by the cli to mint sessions. | (none) |
| `BU_CDP_WS` | cdp WebSocket url `browser-harness` connects to. set on the **first** call only — the daemon caches the connection for subsequent calls under the same `BU_NAME`. | (local Chrome discovery) |
| `BU_NAME` | namespaces the harness daemon socket. **use the KERNEL session id** (`BU_NAME=$SESSION_ID`) — collision-proof per session, no extra naming convention to remember. | `default` |

## basic usage

fast path: create **exactly one** KERNEL browser, save its raw json response in a private, unique temporary file, and derive every value from that file. treat `cdp_ws_url` as a credential: do not log it or copy it between tasks.

run this as one Bash script so the `EXIT` trap cleans up after success, failure, or interruption:

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

KERNEL browsers boot **headful by default** — the create response includes `browser_live_view_url`. print it so the user can watch the agent work, or pass `--headless` to opt out (no live view, smaller image).

### `kernel browsers create` flag picks

common choices when minting a session for harness use:

| flag | use for |
|------|---------|
| `--stealth` (`-s`) | bot-detection bypass — on for most public sites |
| `--headless` (`-H`) | opt out of headful default — no live view, no vnc |
| `--profile-name NAME` | reuse a saved KERNEL profile (logged-in state, cookies, localStorage) |
| `--proxy-id ID` | route through a KERNEL-managed proxy (residential, regional, etc.) |
| `--timeout N` | idle timeout in seconds (default 60, max 259200) — bump for long agent runs |
| `--start-url URL` | open a url when the session boots |
| `--save-changes` | persist profile mutations back when the session ends |

see `kernel browsers create --help` for the full list.

default stealth proxy control is a runtime update, not a create flag. if a stealth session must connect directly, run this **before** the first harness call:

```bash
kernel browsers update "$SESSION_ID" --disable-default-proxy
```

re-enable the default stealth proxy with `--disable-default-proxy=false`. use `--proxy-id` or `--clear-proxy` instead when changing an explicitly configured proxy.

## multi-step usage

for tasks that span more than one harness invocation — mint, drive, inspect, drive more, tear down — the daemon holds the cdp connection. put every invocation before the owning script's `EXIT` trap runs; `BU_CDP_WS` is needed only on the **first** call for that `BU_NAME`.

with `BU_NAME=$SESSION_ID` as the convention, every subsequent harness call is just:

```bash
BU_NAME=$SESSION_ID browser-harness <<'PY'
print(js("document.title"))
PY
```

— and parallel sessions are automatic: each KERNEL browser has a unique session id, so two `BU_NAME=$SESSION_ID` invocations against different sessions never collide on the daemon socket.

if separate shell processes are unavoidable, let the parent orchestrator own the response file and final cleanup; a trap in a short-lived mint subprocess would delete the session too early. reload `session_id` and `cdp_ws_url` from the saved json when variables are lost. if the file is gone, inspect active sessions with `kernel browsers list --limit 100 -o json | jq`; use `--offset` for additional pages and identify the exact session before continuing or deleting anything.

for replay recording around a harness session, see the `kernel-cli` skill's replays reference.

## parallel sessions

create one KERNEL browser per worker and keep each worker's response file, session id, cdp url, and daemon name together. never share a response file or `BU_NAME` between workers. register each session with parent cleanup as soon as its create succeeds:

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

the trap stops each local daemon, deletes each billed KERNEL session, and removes both response files. do not rely on `wait` or the idle timeout for cleanup.

## common gotchas

1. **`BU_CDP_WS unreachable` mid-task**: the KERNEL session probably hit its idle timeout. default is 60s — pass `--timeout 1800` (or whatever fits the task) at create time.

2. **keep urls separated**: treat `cdp_ws_url` as an opaque secret and pass it directly into `BU_CDP_WS` without rewriting it. `browser_live_view_url` is only for the human observer.

3. **daemon won't pick up a new session**: if you mint a new KERNEL browser but reuse a stale `BU_NAME`, the daemon stays connected to the old cdp url. using `BU_NAME=$SESSION_ID` avoids this. otherwise, run `BU_NAME=<name> browser-harness --reload` before connecting that name to a new endpoint.

4. **extra creates waste time and leak money**: one task should usually call `kernel browsers create` once. save and reuse its `-o json` response; never hardcode ids or cdp urls from a previous task.

5. **always tear down both layers**: stop the named local daemon with `BU_NAME="$SESSION_ID" browser-harness --reload`, then run `kernel browsers delete "$SESSION_ID"` and remove the saved json file. `--reload` does not delete the KERNEL browser; KERNEL sessions bill until deletion or idle timeout. put all three operations in an `EXIT` trap for scripts.

`browser-harness`'s skill owns helper usage (`new_tab`, `page_info`, `js`, and so on). the `kernel-cli` skill owns browser and replay lifecycles. keep this skill limited to cli-to-harness wiring.
