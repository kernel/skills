---
name: kernel-replays
description: Record, manage, and download video replays of browser sessions
---

# Replays (Video Recording)

Record browser sessions as videos for debugging, demos, or compliance.

## When to Use

Use replays when you need to:
- **Debug automation failures**: Capture exactly what happened during a failed test or automation run
- **Monitor automation**: Review automated processes to identify optimization opportunities

Replays give you full control over recording start/stop times and support multiple recordings per session.

## Prerequisites

Load the `/kernel-cli` skill for Kernel CLI installation and authentication.

## List Replays

```bash
kernel browsers replays list <session_id> -o json
```

## Start Recording

```bash
# Start with default settings
kernel browsers replays start <session_id> -o json

# With custom settings
kernel browsers replays start <session_id> --framerate 30 --max-duration 300 -o json
```

## Stop Recording

```bash
kernel browsers replays stop <session_id> <replay-id>
```

## Download Recording

```bash
kernel browsers replays download <session_id> <replay-id>
```
