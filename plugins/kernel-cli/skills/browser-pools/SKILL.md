---
name: kernel-browser-pools
description: Manage pre-warmed browser pools for fast acquisition and release of browser instances
---

# Browser Pools

Pre-warmed browser instances for fast acquisition. Ideal for high-throughput automation.

> **Note:** Unless otherwise noted, `id` arguments refer to the browser session ID, not invocation IDs returned by Kernel commands.

## When to Use

Browser pools are ideal when you need to:

- **Minimize latency** for browser acquisition with complex configurations (profiles, proxies, extensions)
- **Run many short-lived browser tasks** in parallel with consistent startup times
- **Maintain consistent browser configuration** across multiple sessions
- **High-throughput automation** where browser creation overhead impacts performance
- **Parallel scraping** of many pages with identical browser settings

For one-off or long-running browser sessions, creating browsers directly with `kernel browsers create` may be simpler.

## Prerequisites

See [prerequisites.md](../../reference/prerequisites.md) for Kernel CLI setup.

## Create Pool

```bash
# Basic pool
kernel browser-pools create --name my-pool --size 5 -o json

# With browser options
kernel browser-pools create --name my-pool --size 10 --stealth --headless -o json
```

## Manage Pools

### List Pools

```bash
kernel browser-pools list -o json
```

### Get Pool Details

```bash
kernel browser-pools get my-pool -o json
```

### Update Pool Size

```bash
kernel browser-pools update my-pool --size 10 -o json
```

### Delete Pool

```bash
kernel browser-pools delete my-pool --force
```

## Acquire and Release

### Acquire a Browser from Pool

```bash
kernel browser-pools acquire my-pool -o json
```

This returns a browser session from the pool instantly.

### Release Browser Back to Pool

```bash
kernel browser-pools release my-pool --session-id <id>
```

## Use Case: High-Volume Scraping

```bash
# Create pool with 20 browsers
kernel browser-pools create --name scraper-pool --size 20 --stealth -o json

# Acquire browsers as needed
for i in {1..100}; do
  SESSION=$(kernel browser-pools acquire scraper-pool -o json | jq -r '.session_id')

  # Use the browser
  kernel browsers playwright execute $SESSION "
    await page.goto('https://example.com/page-${i}');
    return await page.content();
  "

  # Release back to pool
  kernel browser-pools release scraper-pool --session-id $SESSION
done

# Cleanup
kernel browser-pools delete scraper-pool --force
```
