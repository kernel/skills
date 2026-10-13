---
name: kernel-process-execution
description: execute and manage processes inside browser vm environments
---

# process execution

run arbitrary commands inside the browser vm for advanced control.

## when to use

use process execution for:
- **custom tooling** - install specialized tools in the vm (ffmpeg, imagemagick, etc.)
- **background services** - run auxiliary services alongside your browser
- **data processing** - execute scripts for data transformation
- **system configuration** - configure the vm environment to your needs
- **debugging** - inspect vm state and processes
- **package installation** - install system packages with apt-get or other package managers

> **info**: the `<session_id>` argument refers to the browser session id, not invocation ids returned by other KERNEL commands.

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## execute command (synchronous)

```bash
# Execute and wait for completion
kernel browsers process exec <session_id> -- ls -la /tmp

# Execute as root
kernel browsers process exec <session_id> --as-root -- apt-get update

# With timeout (in seconds)
kernel browsers process exec <session_id> --timeout 30 -- long-running-command

# With working directory
kernel browsers process exec <session_id> --cwd /tmp -- pwd

# With specific user
kernel browsers process exec <session_id> --as-user chromium -- whoami

# Set repeatable process-scoped environment variables
kernel browsers process exec <session_id> \
  --env REGION=us-east --env MODE=debug -- printenv REGION MODE
```

## spawn background process (asynchronous)

```bash
# Start long-running process
kernel browsers process spawn <session_id> -- long-running-command

# With timeout
kernel browsers process spawn <session_id> --timeout 300 -- background-task

# Start web server with a process-scoped environment variable
kernel browsers process spawn <session_id> --env PORT=8080 -- \
  /bin/bash -c 'python3 -m http.server "$PORT"'

# Allocate a PTY for a shell or another TTY-dependent program
kernel browsers process spawn <session_id> --allocate-tty --cols 120 --rows 40 -- /bin/bash
```

repeat `--env KEY=VALUE` as needed. `--cols` and `--rows` are valid only with `--allocate-tty`.

## additional process commands

### check process status

```bash
# Get process status
kernel browsers process status <session_id> <process-id>
```

returns process state, cpu usage, memory usage, and exit code.

### stream process output

```bash
# Stream stdout and stderr from a running process
kernel browsers process stdout-stream <session_id> <process-id>
```

this will continuously stream output until the process exits.

### write to process stdin

```bash
# Send base64-encoded data to process stdin
echo "input data" | base64 | xargs -I {} kernel browsers process stdin <session_id> <process-id> --data-b64 {}
```
base64 payload to write is required.

## kill process

```bash
# Kill with TERM signal (graceful, default)
kernel browsers process kill <session_id> <process-id>
kernel browsers process kill <session_id> <process-id> --signal TERM
```
available signals: (TERM, KILL, INT, HUP; default: TERM).
