---
name: kernel-browser-pools
description: manage pre-warmed browser pools for fast acquisition and release of browser instances
---

# Browser Pools

pre-warmed browser instances for fast acquisition. ideal for high-throughput automation.

> **note:** unless otherwise noted, `id` arguments refer to the browser session id, not invocation ids returned by KERNEL commands.

## when to use

browser pools are ideal when you need to:

- **minimize latency** for browser acquisition with complex configurations (profiles, proxies, extensions)
- **run many short-lived browser tasks** in parallel with consistent startup times
- **maintain consistent browser configuration** across multiple sessions
- **high-throughput automation** where browser creation overhead impacts performance
- **parallel scraping** of many pages with identical browser settings

for one-off or long-running browser sessions, creating browsers directly with `kernel browsers create` may be simpler.

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## create pool

```bash
# Basic pool
kernel browser-pools create --name my-pool --size 5 -o json

# With browser options
kernel browser-pools create --name my-pool --size 10 --stealth --headless -o json
```

## manage pools

### list pools

```bash
kernel browser-pools list -o json
```

### get pool details

```bash
kernel browser-pools get my-pool -o json
```

### update pool size

```bash
kernel browser-pools update my-pool --size 10 -o json
```

### delete pool

```bash
kernel browser-pools delete my-pool --force
```

## acquire and release

### acquire a browser from pool

```bash
kernel browser-pools acquire my-pool -o json
```

this returns a browser session from the pool instantly.

### release browser back to pool

```bash
kernel browser-pools release my-pool --session-id <id>
```

## use case: high-volume scraping

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
