---
name: kernel-cli
description: Use the Kernel CLI to manage cloud browsers, apps, profiles, proxies, managed auth, API keys, projects, and organization limits. Use when installing or authenticating the CLI, looking up current command syntax, or choosing the right command group.
---

# Kernel CLI

The Kernel CLI provides command-line access to Kernel's cloud browser platform for browser automation, serverless app deployment, and infrastructure management.

## Installation

- Homebrew: `brew install kernel/tap/kernel`
- npm: `npm install -g @onkernel/cli`

Verify with `kernel --version`. Use `kernel <command> --help` as the source of truth for the installed version.

## Authentication

- **Preferred:** Set `KERNEL_API_KEY` environment variable
- **Fallback:** Run `kernel login` for interactive OAuth

## Quick Start

```bash
# Authenticate
export KERNEL_API_KEY=your_api_key

# Create a browser session
kernel browsers create --telemetry=console,network,page -o json

# Run Playwright automation (use `return` to get a value back)
kernel browsers playwright execute <session_id> '
  await page.goto("https://example.com");
  return await page.evaluate(() => document.title);
'

# Take a screenshot
kernel browsers computer screenshot <session_id> --to screenshot.png

# Cleanup
kernel browsers delete <session_id>
```

## Safe Operation

- Prefer `-o json` plus `jq` for scripts; deploy and invoke emit JSONL rather than one JSON object.
- Use `--project <id-or-name>` or `KERNEL_PROJECT` when an API key can access multiple projects.
- Keep confirmation prompts for destructive operations unless non-interactive execution is intentional.
- Delete created browser sessions and pools after testing. Never echo, log, commit, or share API keys, credentials, or proxy passwords.
- Check telemetry first, and reach for a screenshot only when you need to *see* something telemetry can't tell you. `kernel browsers telemetry events <id>` (or `telemetry stream`) gives structured, timestamped confirmation (`page_load`, `network_idle`, `console_error`, `captcha_solve_result`) — faster, cheaper on tokens, and more reliable than a screenshot, since it's exact status codes and error text instead of pixels you have to interpret. Only screenshot for layout/visual bugs, CAPTCHA appearance, or confirming a coordinate-based click landed correctly — things telemetry structurally can't express.

## Project, API Key, and Organization Administration

```bash
# Rename, archive, or reactivate a project (provide at least one update)
kernel projects update <id-or-name> --name <new-name> -o json
kernel projects update <id-or-name> --status archived -o json
kernel projects update <id-or-name> --status active -o json

# Look up a soft-deleted API key
kernel api-keys get <id> --include-deleted -o json

# Inspect limits before changing the default project cap
kernel org limits get -o json
kernel org limits set --default-project-max-concurrent-sessions <n> -o json
```

For `org limits set`, `0` removes the default cap; the value cannot exceed the organization concurrency limit.

Rotate an API key interactively with `kernel api-keys rotate <id>`. Use `--days-to-expire <1-3650>` to set the replacement key lifetime and `--expire-in-days <n>` to set the old key's grace period (default 7 days; `0` revokes it immediately). The output contains the replacement plaintext key once: keep it out of logs, migrate callers during the grace period, and then verify the old key no longer works.

## References

- [Browser Management](./references/browser-management.md) - Create, list, view, and delete browser sessions
- [App Deployment](./references/app-deployment.md) - Deploy TypeScript/Python apps and invoke actions
- [Computer Controls](./references/computer-controls.md) - OS-level mouse, keyboard, and screenshot capabilities
- [Process Execution](./references/process-execution.md) - Execute and manage processes in browser VMs
- [Profiles](./references/profiles.md) - Manage persistent browser profiles
- [Managed Auth](./references/managed-auth.md) - Auth connections, login sessions, credential providers, auto re-authentication
- [Proxies](./references/proxies.md) - Create and manage datacenter, ISP, residential, and mobile proxies
- [Browser Pools](./references/browser-pools.md) - Manage pre-warmed browser pools
- [Extensions](./references/extensions.md) - Upload and manage Chrome extensions
- [Replays](./references/replays.md) - Record and download video replays
- [Filesystem Operations](./references/filesystem-ops.md) - Read, write, upload, and download files
- [Browser Telemetry](../kernel-browser-telemetry/SKILL.md) - Console, network, page, and interaction events for faster session introspection
