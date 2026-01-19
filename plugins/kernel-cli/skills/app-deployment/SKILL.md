---
name: kernel-app-deployment
description: Deploy TypeScript/Python apps, invoke actions, and monitor logs in Kernel environment
allowed-tools:
  - invoke_action
  - get_deployment
  - search_docs
---

# App Deployment and Invocation

Deploy serverless apps to Kernel and invoke them with payloads.

## Deploy Apps

### TypeScript

```bash
kernel deploy index.ts
kernel deploy index.ts -o json
```

### Python

```bash
kernel deploy main.py
kernel deploy main.py -o json
```

### With Environment Variables

```bash
# Inline env vars
kernel deploy index.ts --env API_KEY=secret --env DB_URL=postgres://...

# From .env file
kernel deploy index.ts --env-file .env
```

## Invoke Apps

### Basic Invocation

```bash
kernel invoke <app> <action-name>
```

### With Payload

```bash
# Inline JSON payload
kernel invoke my-app scrape --payload '{"url": "https://example.com"}'

# From file
kernel invoke my-app scrape --payload-file payload.json
```

### Synchronous Invocation

```bash
# Wait for completion
kernel invoke my-app scrape --sync

# With JSON output
kernel invoke my-app scrape --sync -o json
```

## View Logs

```bash
# Recent logs
kernel logs <app-name>

# Follow logs (stream)
kernel logs <app-name> --follow

# With filters
kernel logs <app-name> --since 1h --with-timestamps
```

## Complete Workflow Example

```bash
# Deploy app
kernel deploy index.ts --env-file .env

# Invoke action
kernel invoke my-app my-action --payload '{"key": "value"}' --sync

# Monitor logs
kernel logs my-app --follow
```

## App Structure Example

```typescript
// index.ts
export async function scrape(payload: { url: string }) {
  const browser = await createBrowser();
  const page = await browser.newPage();
  await page.goto(payload.url);
  const title = await page.title();
  await browser.close();
  return { title };
}
```
