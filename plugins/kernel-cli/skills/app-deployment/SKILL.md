---
name: kernel-app-deployment
description: Deploy TypeScript/Python apps, invoke actions, and monitor logs in Kernel environment
---

# App Deployment and Invocation

Deploy serverless apps to Kernel and invoke them with payloads.

## When to Use This Skill

Use app-deployment when you need to:
- Deploy serverless TypeScript or Python applications to Kernel
- Invoke deployed actions with custom payloads
- Monitor application logs in real-time
- Run browser automation or data processing tasks at scale
- Deploy apps with environment variables and secrets

**Don't use this when:**
- You need one-off browser automation → Use `browser-management` directly

## Prerequisites

### General
See [prerequisites.md](../../reference/prerequisites.md) for Kernel CLI setup.

### App Deployment Specific
- Valid TypeScript (.ts) or Python (.py) entry file
- `package.json` (JS/TS) or `pyproject.toml` (Python) must be present next to the entrypoint
- Node.js/Bun or Python runtime (for local testing)

## Deploy Apps

### TypeScript

**Command:**
```bash
kernel deploy index.ts -o json
```

**Note:** Ensure `package.json` is present in the same directory as `index.ts`.

### Python

**Command:**
```bash
kernel deploy main.py -o json
```

**Note:** Ensure `pyproject.toml` is present in the same directory as `main.py`.

### With Environment Variables

**Command:**
```bash
# Inline env vars
kernel deploy index.ts --env API_KEY=secret --env DB_URL=postgres://... -o json

# From .env file
kernel deploy index.ts --env-file .env -o json
```

**MCP Tool:** Use `kernel:get_deployment` with `deployment_id` to check deployment status.

## Invoke Apps

### Basic Invocation

**Command:**
```bash
kernel invoke my-app scrape -o json
```

**MCP Tool:** Use `kernel:invoke_action` with `app_name`, `action_name`, and optional `payload`.

### With Payload

**Command:**
```bash
# Inline JSON payload (max 64 KB)
kernel invoke my-app scrape --payload '{"url": "https://example.com"}' -o json

# From file
kernel invoke my-app scrape --payload-file payload.json -o json
```

**Note:** JSON payloads are limited to 64 KB maximum.

### Synchronous Invocation

**Command:**
```bash
# Wait for completion (timeout after 60s)
kernel invoke my-app scrape --payload '{"url": "https://example.com"}' --sync -o json
```

**Note:**
- Synchronous invocations timeout after 60 seconds
- JSON payloads are limited to 64 KB maximum
- Press `Ctrl+C` to cancel an in-flight invocation (associated browser sessions are cleaned up automatically)

## View Logs

**Command:**
```bash
# Recent logs
kernel logs my-app
```

**Follow logs (stream):**
```bash
kernel logs my-app --follow
```

**Expected Output:** Real-time log stream (continues until Ctrl+C)

**With filters:**
```bash
# Logs from last hour with timestamps
kernel logs my-app --since 1h --with-timestamps
```

**Note:** Log lines longer than 64 KiB are truncated. For bulky payloads, emit them to external storage and log references instead.

## Complete Workflow Example

**End-to-end deployment and invocation:**

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

## Troubleshooting

### Deployment Fails

**Error:** `401 Unauthorized`
- **Solution:** Run `kernel login` to re-authenticate

**Error:** `file not found: index.ts`
- **Solution:** Ensure entry file exists and path is correct
- **Check:** Run `ls -la index.ts` to verify file exists

**Error:** `syntax error in index.ts`
- **Solution:** Fix TypeScript/Python syntax errors
- **Check:** Run local linter or type checker first
