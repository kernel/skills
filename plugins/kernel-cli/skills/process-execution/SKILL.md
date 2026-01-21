---
name: kernel-process-execution
description: Execute and manage processes inside browser VM environments
---

# Process Execution

Run arbitrary commands inside the browser VM for advanced control.

## When to Use

Use process execution for:
- **Custom tooling** - Install specialized tools in the VM (ffmpeg, imagemagick, etc.)
- **Background services** - Run auxiliary services alongside your browser
- **Data processing** - Execute scripts for data transformation
- **System configuration** - Configure the VM environment to your needs
- **Debugging** - Inspect VM state and processes
- **Package installation** - Install system packages with apt-get or other package managers

> **Info**: The `<session_id>` argument refers to the browser session ID, not invocation IDs returned by other Kernel commands.

## Prerequisites

See [prerequisites.md](../../reference/prerequisites.md) for Kernel CLI setup.

## Execute Command (Synchronous)

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
```

### Output Format

The `exec` command displays:
- **Exit Code** - The command's exit status
- **Duration (ms)** - How long the command took to execute
- **stdout** - Standard output from the command
- **stderr** - Standard error from the command

Example output:
```
Property     | Value
Exit Code    | 0
Duration (ms)| 125

stdout:
total 8
drwxrwxrwt 2 root root 4096 Jan 21 10:30 .
drwxr-xr-x 1 root root 4096 Jan 21 10:29 ..
```

## Spawn Background Process (Asynchronous)

```bash
# Start long-running process
kernel browsers process spawn <session_id> -- long-running-command

# With timeout
kernel browsers process spawn <session_id> --timeout 300 -- background-task

# Start web server
kernel browsers process spawn <session_id> -- python3 -m http.server 8080
```

### Output Format

The `spawn` command returns:
- **Process ID** - Unique identifier for the spawned process
- **PID** - System process ID
- **Started At** - Timestamp when the process started

Example output:
```
Property   | Value
Process ID | proc_abc123xyz
PID        | 1234
Started At | 2026-01-21 10:30:15
```

Use the Process ID with other commands to manage the process.

## Additional Process Commands

### Check Process Status

```bash
# Get process status
kernel browsers process status <session_id> <process-id>
```

Returns process state, CPU usage, memory usage, and exit code.

### Stream Process Output

```bash
# Stream stdout and stderr from a running process
kernel browsers process stdout-stream <session_id> <process-id>
```

This will continuously stream output until the process exits.

### Write to Process stdin

```bash
# Send base64-encoded data to process stdin
echo "input data" | base64 | xargs -I {} kernel browsers process stdin <session_id> <process-id> --data-b64 {}
```
Base64 payload to write is required.

## Kill Process

```bash
# Kill with TERM signal (graceful, default)
kernel browsers process kill <session_id> <process-id>
kernel browsers process kill <session_id> <process-id> --signal TERM
```

Available signals: (TERM, KILL, INT, HUP; default: TERM).
