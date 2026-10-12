---
name: kernel-replays
description: record, manage, and download video replays of browser sessions
---

# replays (video recording)

record browser sessions as videos for debugging, demos, or compliance.

## when to use

use replays when you need to:
- **debug automation failures**: capture exactly what happened during a failed test or automation run
- **monitor automation**: review automated processes to identify optimization opportunities

replays give you full control over recording start/stop times and support multiple recordings per session.

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## list replays

```bash
kernel browsers replays list <session_id> -o json
```

## start recording

```bash
# Start with default settings
kernel browsers replays start <session_id> -o json

# With custom settings
kernel browsers replays start <session_id> --framerate 30 --max-duration 300 -o json
```

## stop recording

```bash
kernel browsers replays stop <session_id> <replay-id>
```

## download recording

```bash
kernel browsers replays download <session_id> <replay-id>
```
