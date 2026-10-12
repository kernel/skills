---
name: kernel-app-deployment
description: deploy TypeScript/Python apps, invoke actions, and monitor logs in KERNEL environment
---

# App Deployment and Invocation

deploy serverless apps to KERNEL and invoke them with payloads.

## when to use this skill

use app-deployment when you need to:
- deploy serverless TypeScript or Python applications to KERNEL
- invoke deployed actions with custom payloads
- monitor application logs in real-time
- run browser automation or data processing tasks at scale
- deploy apps with environment variables and secrets

**don't use this when:**
- you need one-off browser automation → use `browser-management` directly

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

### app deployment specific
- valid TypeScript (.ts) or Python (.py) entry file
- `package.json` (js/ts) or `pyproject.toml` (Python) must be present next to the entrypoint
- Node.js/Bun or Python runtime (for local testing)

## deploy apps

### TypeScript

**command:**
```bash
kernel deploy index.ts -o json
```

**note:** ensure `package.json` is present in the same directory as `index.ts`.

### Python

**command:**
```bash
kernel deploy main.py -o json
```

**note:** ensure `pyproject.toml` is present in the same directory as `main.py`.

### with environment variables

**command:**
```bash
# Inline env vars
kernel deploy index.ts --env API_KEY=secret --env DB_URL=postgres://... -o json

# From .env file
kernel deploy index.ts --env-file .env -o json
```

**mcp tool:** use `kernel:get_deployment` with `deployment_id` to check deployment status.

## invoke apps

### basic invocation

**command:**
```bash
kernel invoke my-app scrape -o json
```

**mcp tool:** use `kernel:invoke_action` with `app_name`, `action_name`, and optional `payload`.

### with payload

**command:**
```bash
# Inline JSON payload (max 4.5 MB)
kernel invoke my-app scrape --payload '{"url": "https://example.com"}' -o json

# From file
kernel invoke my-app scrape --payload-file payload.json -o json
```

**note:** json payloads are limited to 4.5 mb maximum.

### synchronous invocation

**command:**
```bash
# Wait for completion (timeout after 60s)
kernel invoke my-app scrape --payload '{"url": "https://example.com"}' --sync -o json
```

**note:**
- synchronous invocations timeout after 60 seconds
- json payloads are limited to 4.5 mb maximum
- press `Ctrl+C` to cancel an in-flight invocation (associated browser sessions are cleaned up automatically)

## view logs

**command:**
```bash
# Recent logs
kernel logs my-app
```

**follow logs (stream):**
```bash
kernel logs my-app --follow
```

**expected output:** real-time log stream (continues until Ctrl+C)

**with filters:**
```bash
# Logs from last hour with timestamps
kernel logs my-app --since 1h --with-timestamps
```

**note:** log lines longer than 64 KiB are truncated. for bulky payloads, emit them to external storage and log references instead.

## complete workflow example

**end-to-end deployment and invocation:**

```bash
# 1. Deploy app with environment variables
kernel deploy index.ts --env-file .env -o json
# Output: {"deployment_id": "dep_123", "app_name": "my-app", "status": "deployed"}

# 2. Invoke action synchronously
kernel invoke my-app scrape --payload '{"url": "https://example.com"}' --sync -o json
# Output: {"invocation_id": "inv_456", "status": "completed", "result": {...}}

# 3. Monitor logs in real-time
kernel logs my-app --follow
# Output: Live log stream...
```

## troubleshooting

### deployment fails

**error:** `401 Unauthorized`
- **solution:** run `kernel login` to re-authenticate

**error:** `file not found: index.ts`
- **solution:** ensure entry file exists and path is correct
- **check:** run `ls -la index.ts` to verify file exists

**error:** `syntax error in index.ts`
- **solution:** fix TypeScript/Python syntax errors
- **check:** run local linter or type checker first
