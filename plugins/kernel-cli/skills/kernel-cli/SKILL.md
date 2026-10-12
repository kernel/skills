---
name: kernel-cli
description: use the KERNEL cli to manage cloud browsers, apps, profiles, proxies, managed auth, api keys, projects, and organization limits. use when installing or authenticating the cli, looking up current command syntax, or choosing the right command group.
---

# KERNEL cli

the KERNEL cli provides command-line access to KERNEL's cloud browser platform for browser automation, serverless app deployment, and infrastructure management.

## installation

- Homebrew: `brew install kernel/tap/kernel`
- npm: `npm install -g @onkernel/cli`

verify with `kernel --version`. use `kernel <command> --help` as the source of truth for the installed version.

## authentication

- **preferred:** set `KERNEL_API_KEY` environment variable
- **fallback:** run `kernel login` for interactive OAuth

## quick start

```bash
# Authenticate
export KERNEL_API_KEY=your_api_key

# Create a browser session
kernel browsers create -o json

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

## safe operation

- prefer `-o json` plus `jq` for scripts; deploy and invoke emit jsonl rather than one json object.
- use `--project <id-or-name>` or `KERNEL_PROJECT` when an api key can access multiple projects.
- keep confirmation prompts for destructive operations unless non-interactive execution is intentional.
- delete created browser sessions and pools after testing. never echo, log, commit, or share api keys, credentials, or proxy passwords.

## project, api key, and organization administration

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

for `org limits set`, `0` removes the default cap; the value cannot exceed the organization concurrency limit.

rotate an api key interactively with `kernel api-keys rotate <id>`. use `--days-to-expire <1-3650>` to set the replacement key lifetime and `--expire-in-days <n>` to set the old key's grace period (default 7 days; `0` revokes it immediately). the output contains the replacement plaintext key once: keep it out of logs, migrate callers during the grace period, and then verify the old key no longer works.

## references

- [browser management](./references/browser-management.md) - create, list, view, and delete browser sessions
- [app deployment](./references/app-deployment.md) - deploy TypeScript/Python apps and invoke actions
- [computer controls](./references/computer-controls.md) - os-level mouse, keyboard, and screenshot capabilities
- [process execution](./references/process-execution.md) - execute and manage processes in browser vms
- [profiles](./references/profiles.md) - manage persistent browser profiles
- [managed auth](./references/managed-auth.md) - auth connections, login sessions, credential providers, auto re-authentication
- [proxies](./references/proxies.md) - create and manage datacenter, isp, residential, and mobile proxies
- [browser pools](./references/browser-pools.md) - manage pre-warmed browser pools
- [extensions](./references/extensions.md) - upload and manage Chrome extensions
- [replays](./references/replays.md) - record and download video replays
- [filesystem operations](./references/filesystem-ops.md) - read, write, upload, and download files
