# Kernel CLI Command Reference

Complete reference for all Kernel CLI commands.

## Authentication

### kernel login

Login via OAuth 2.0 (opens browser).

```bash
kernel login
kernel login --force    # Force re-authentication
```

### kernel logout

Clear stored credentials.

```bash
kernel logout
```

### kernel auth

Check authentication status.

```bash
kernel auth
```

## App Creation

### kernel create

Create a new Kernel app from a template.

| Flag | Description |
|------|-------------|
| `--name`, `-n` | Application name |
| `--language`, `-l` | Language: typescript, python |
| `--template`, `-t` | Template name |

Templates:
- `sample-app` - Basic Playwright integration
- `captcha-solver` - Auto-CAPTCHA solver demo
- `stagehand` - Stagehand SDK (TypeScript only)
- `browser-use` - Browser Use SDK (Python only)
- `anthropic-computer-use` - Anthropic Computer Use
- `openai-computer-use` - OpenAI Computer Use
- `gemini-computer-use` - Gemini Computer Use (TypeScript only)
- `openagi-computer-use` - OpenAGI Lux (Python only)
- `magnitude` - Magnitude framework (TypeScript only)
- `claude-agent-sdk` - Claude Agent SDK

```bash
kernel create
kernel create --name my-app --language typescript --template sample-app
kernel create -n my-scraper -l python -t browser-use
```

## Deployment

### kernel deploy

Deploy an app to Kernel.

| Flag | Description |
|------|-------------|
| `--version` | App version (default: latest) |
| `--force` | Allow overwriting existing version |
| `--env`, `-e` | Set environment variable (repeatable) |
| `--env-file` | Load env vars from file (repeatable) |
| `--output`, `-o` | Output format: json |

```bash
kernel deploy index.ts
kernel deploy main.py --env API_KEY=secret --env DEBUG=true
kernel deploy index.ts --env-file .env --env OVERRIDE=value
kernel deploy index.ts -o json
```

### kernel deploy logs

Stream deployment logs.

| Flag | Description |
|------|-------------|
| `--follow`, `-f` | Follow logs in real-time |
| `--since`, `-s` | How far back (e.g., 5m, 2h, 1h30m) |
| `--with-timestamps`, `-t` | Include timestamps |

```bash
kernel deploy logs <deployment_id>
kernel deploy logs <deployment_id> --follow --since 5m
```

### kernel deploy history

Show deployment history.

| Flag | Description |
|------|-------------|
| `--limit` | Max deployments (default: 100, 0=all) |
| `--output`, `-o` | Output format: json |

```bash
kernel deploy history my-app
kernel deploy history my-app --limit 10 -o json
```

## App Management

### kernel invoke

Run an app action.

| Flag | Description |
|------|-------------|
| `--version`, `-v` | App version (default: latest) |
| `--payload`, `-p` | JSON payload |
| `--payload-file`, `-f` | Read payload from file (use `-` for stdin) |
| `--sync`, `-s` | Synchronous invoke (timeout 60s) |
| `--output`, `-o` | Output format: json |

```bash
kernel invoke my-app my-action
kernel invoke my-app scrape --payload '{"url": "https://example.com"}'
kernel invoke my-app scrape --payload-file payload.json
kernel invoke my-app scrape -f -    # Read from stdin
kernel invoke my-app task --sync
```

### kernel app list

List deployed apps.

| Flag | Description |
|------|-------------|
| `--name` | Filter by app name |
| `--version` | Filter by version |
| `--output`, `-o` | Output format: json |

```bash
kernel app list
kernel app list --name my-app -o json
```

### kernel app history

Show deployment history for an app.

```bash
kernel app history my-app
kernel app history my-app --limit 10 -o json
```

### kernel logs

View app logs.

| Flag | Description |
|------|-------------|
| `--version` | App version |
| `--follow`, `-f` | Follow logs in real-time |
| `--since`, `-s` | How far back |
| `--with-timestamps` | Include timestamps |

```bash
kernel logs my-app
kernel logs my-app --follow --since 1h --with-timestamps
```

## Browser Management

### kernel browsers create

Create a new browser session.

| Flag | Description |
|------|-------------|
| `-s`, `--stealth` | Stealth mode (avoid detection) |
| `-H`, `--headless` | Headless mode (no GUI) |
| `--kiosk` | Kiosk mode |
| `--timeout` | Idle timeout in seconds (max 72 hours) |
| `--pool-id` | Acquire from pool by ID |
| `--pool-name` | Acquire from pool by name |
| `--profile-id` | Use profile by ID |
| `--profile-name` | Use profile by name |
| `--save-changes` | Save profile changes |
| `--proxy-id` | Use proxy |
| `--extension` | Load extension (repeatable) |
| `--viewport` | Viewport size (e.g., 1920x1080) |
| `--output`, `-o` | Output format: json |

```bash
kernel browsers create
kernel browsers create -o json
kernel browsers create --stealth --headless -o json
kernel browsers create --timeout 3600 -o json
kernel browsers create --profile-name my-profile --save-changes -o json
kernel browsers create --pool-name my-pool -o json
```

### kernel browsers list

List running browsers.

```bash
kernel browsers list
kernel browsers list -o json
```

### kernel browsers get

Get browser session details.

```bash
kernel browsers get <session_id>
kernel browsers get <session_id> -o json
```

### kernel browsers view

Get live view URL.

```bash
kernel browsers view <session_id>
kernel browsers view <session_id> -o json
```

### kernel browsers delete

Delete a browser session.

```bash
kernel browsers delete <session_id>
kernel browsers delete <session_id> --yes    # Skip confirmation
```

## Playwright Execution

### kernel browsers playwright execute

Execute Playwright/TypeScript code in the browser VM.

| Flag | Description |
|------|-------------|
| `--timeout` | Max execution time in seconds |

Available variables: `page`, `context`, `browser`.

```bash
kernel browsers playwright execute <session_id> 'await page.goto("https://example.com"); return page.title();'

# From stdin
cat script.ts | kernel browsers playwright execute <session_id>

# Multi-line
cat <<'TS' | kernel browsers playwright execute <session_id>
await page.goto("https://example.com");
const title = await page.title();
return { title };
TS
```

## Computer Controls

### kernel browsers computer screenshot

Capture a screenshot.

| Flag | Description |
|------|-------------|
| `--to` | Output file path (required) |
| `--x` | Region top-left X |
| `--y` | Region top-left Y |
| `--width` | Region width |
| `--height` | Region height |

```bash
kernel browsers computer screenshot <session_id> --to screenshot.png
kernel browsers computer screenshot <session_id> --to region.png --x 0 --y 0 --width 800 --height 600
```

### kernel browsers computer click-mouse

Click mouse at coordinates.

| Flag | Description |
|------|-------------|
| `--x` | X coordinate (required) |
| `--y` | Y coordinate (required) |
| `--num-clicks` | Number of clicks (default: 1) |
| `--button` | Button: left, right, middle, back, forward |
| `--click-type` | Type: down, up, click |
| `--hold-key` | Modifier keys (repeatable) |

```bash
kernel browsers computer click-mouse <session_id> --x 100 --y 200
kernel browsers computer click-mouse <session_id> --x 100 --y 200 --button right --num-clicks 2
```

### kernel browsers computer move-mouse

Move mouse to coordinates.

```bash
kernel browsers computer move-mouse <session_id> --x 500 --y 300
kernel browsers computer move-mouse <session_id> --x 500 --y 300 --hold-key Alt
```

### kernel browsers computer type

Type text.

| Flag | Description |
|------|-------------|
| `--text` | Text to type (required) |
| `--delay` | Delay between keystrokes in ms |

```bash
kernel browsers computer type <session_id> --text "Hello, World!"
kernel browsers computer type <session_id> --text "Slow typing" --delay 100
```

### kernel browsers computer press-key

Press keys.

| Flag | Description |
|------|-------------|
| `--key` | Key symbols (repeatable) |
| `--duration` | Hold duration in ms |
| `--hold-key` | Modifier keys (repeatable) |

```bash
kernel browsers computer press-key <session_id> --key Enter
kernel browsers computer press-key <session_id> --key Ctrl+t
kernel browsers computer press-key <session_id> --key Ctrl+Shift+Tab --duration 250 --hold-key Alt
```

### kernel browsers computer scroll

Scroll at position.

| Flag | Description |
|------|-------------|
| `--x` | X coordinate (required) |
| `--y` | Y coordinate (required) |
| `--delta-x` | Horizontal scroll (+right, -left) |
| `--delta-y` | Vertical scroll (+down, -up) |
| `--hold-key` | Modifier keys |

```bash
kernel browsers computer scroll <session_id> --x 300 --y 400 --delta-y 120
kernel browsers computer scroll <session_id> --x 300 --y 400 --delta-x -50
```

### kernel browsers computer drag-mouse

Drag along a path.

| Flag | Description |
|------|-------------|
| `--point` | Point as x,y (repeatable) |
| `--delay` | Delay before drag in ms |
| `--button` | Button: left, middle, right |
| `--hold-key` | Modifier keys |

```bash
kernel browsers computer drag-mouse <session_id> --point 100,200 --point 150,220 --point 200,260
```

## Browser Pools

### kernel browser-pools create

Create a browser pool.

| Flag | Description |
|------|-------------|
| `--name` | Pool name |
| `--size` | Pool size (required) |
| `--fill-rate` | Fill rate % per minute |
| `--timeout` | Idle timeout for acquired browsers |
| `--stealth`, `--headless`, `--kiosk` | Default config |
| `--profile-id`, `--profile-name` | Default profile |
| `--proxy-id` | Default proxy |
| `--extension` | Default extensions |
| `--viewport` | Default viewport |
| `--output`, `-o` | Output format: json |

```bash
kernel browser-pools create --name my-pool --size 5 -o json
kernel browser-pools create --name stealth-pool --size 10 --stealth --headless -o json
```

### kernel browser-pools list

```bash
kernel browser-pools list
kernel browser-pools list -o json
```

### kernel browser-pools get

```bash
kernel browser-pools get my-pool
kernel browser-pools get my-pool -o json
```

### kernel browser-pools update

```bash
kernel browser-pools update my-pool --size 10 -o json
kernel browser-pools update my-pool --discard-all-idle -o json
```

### kernel browser-pools delete

```bash
kernel browser-pools delete my-pool
kernel browser-pools delete my-pool --force    # Force even if browsers leased
```

### kernel browser-pools acquire

Acquire a browser from the pool.

```bash
kernel browser-pools acquire my-pool -o json
kernel browser-pools acquire my-pool --timeout 30 -o json
```

### kernel browser-pools release

Release a browser back to the pool.

```bash
kernel browser-pools release my-pool --session-id <id>
kernel browser-pools release my-pool --session-id <id> --reuse    # Reuse instance
```

### kernel browser-pools flush

Destroy all idle browsers.

```bash
kernel browser-pools flush my-pool
```

## Profiles

### kernel profiles create

```bash
kernel profiles create --name my-profile -o json
```

### kernel profiles list

```bash
kernel profiles list
kernel profiles list -o json
```

### kernel profiles get

```bash
kernel profiles get <profile-id>
kernel profiles get <profile-id> -o json
```

## Extensions

### kernel extensions list

```bash
kernel extensions list
kernel extensions list -o json
```

### kernel extensions upload

```bash
kernel extensions upload ./my-extension --name my-ext -o json
```

### kernel extensions download

```bash
kernel extensions download my-ext --to ./downloaded
```

### kernel extensions download-web-store

```bash
kernel extensions download-web-store "https://chrome.google.com/webstore/detail/..." --to ./ext
kernel extensions download-web-store "..." --to ./ext --os mac
```

### kernel extensions delete

```bash
kernel extensions delete my-ext
kernel extensions delete my-ext --yes
```

### kernel browsers extensions upload

Upload extensions to a running browser.

```bash
kernel browsers extensions upload <session_id> ./ext1 ./ext2
```

## Proxies

### kernel proxies create

| Flag | Description |
|------|-------------|
| `--name` | Proxy name |
| `--type` | Type: datacenter, isp, residential, mobile, custom |
| `--protocol` | Protocol: http, https (default: https) |
| `--country` | ISO country code or "EU" |
| `--city` | City name (no spaces) |
| `--state` | Two-letter state code |
| `--zip` | US ZIP code |
| `--asn` | ASN (e.g., AS15169) |
| `--os` | OS: windows, macos, android |
| `--carrier` | Mobile carrier |
| `--host` | Custom proxy host |
| `--port` | Custom proxy port |
| `--username` | Auth username |
| `--password` | Auth password |
| `--output`, `-o` | Output format: json |

```bash
kernel proxies create --type datacenter --country US --name "US DC" -o json
kernel proxies create --type residential --country US --city sanfrancisco --state CA -o json
kernel proxies create --type custom --host proxy.example.com --port 8080 --username user --password pass -o json
```

### kernel proxies list

```bash
kernel proxies list
kernel proxies list -o json
```

### kernel proxies get

```bash
kernel proxies get <proxy-id>
kernel proxies get <proxy-id> -o json
```

### kernel proxies delete

```bash
kernel proxies delete <proxy-id>
kernel proxies delete <proxy-id> --yes
```

## Process Execution

### kernel browsers process exec

Execute command synchronously.

| Flag | Description |
|------|-------------|
| `--command` | Command to execute |
| `--args` | Command arguments |
| `--cwd` | Working directory |
| `--timeout` | Timeout in seconds |
| `--as-user` | Run as user |
| `--as-root` | Run as root |
| `--output`, `-o` | Output format: json |

```bash
kernel browsers process exec <session_id> -- ls -la /tmp
kernel browsers process exec <session_id> --as-root -- apt-get update
kernel browsers process exec <session_id> --cwd /home/user -- ./script.sh
```

### kernel browsers process spawn

Execute command asynchronously.

```bash
kernel browsers process spawn <session_id> -- long-running-command
kernel browsers process spawn <session_id> -o json -- ./background-task.sh
```

### kernel browsers process kill

Send signal to process.

| Flag | Description |
|------|-------------|
| `--signal` | Signal: TERM, KILL, INT, HUP (default: TERM) |

```bash
kernel browsers process kill <session_id> <process-id>
kernel browsers process kill <session_id> <process-id> --signal KILL
```

### kernel browsers process status

```bash
kernel browsers process status <session_id> <process-id>
```

### kernel browsers process stdin

Write to process stdin.

```bash
kernel browsers process stdin <session_id> <process-id> --data-b64 <base64-data>
```

### kernel browsers process stdout-stream

Stream process output.

```bash
kernel browsers process stdout-stream <session_id> <process-id>
```

## Filesystem Operations

### kernel browsers fs list-files

```bash
kernel browsers fs list-files <session_id> --path /tmp
kernel browsers fs list-files <session_id> --path /tmp -o json
```

### kernel browsers fs file-info

```bash
kernel browsers fs file-info <session_id> --path /tmp/file.txt
kernel browsers fs file-info <session_id> --path /tmp/file.txt -o json
```

### kernel browsers fs read-file

```bash
kernel browsers fs read-file <session_id> --path /tmp/file.txt
kernel browsers fs read-file <session_id> --path /tmp/file.txt -o ./local.txt
```

### kernel browsers fs write-file

```bash
kernel browsers fs write-file <session_id> --path /tmp/output.txt --source ./local.txt
kernel browsers fs write-file <session_id> --path /tmp/output.txt --source ./local.txt --mode 0644
```

### kernel browsers fs upload

```bash
kernel browsers fs upload <session_id> --file "local.txt:/tmp/remote.txt"
kernel browsers fs upload <session_id> --paths ./file1.txt ./file2.txt --dest-dir /tmp
```

### kernel browsers fs upload-zip

```bash
kernel browsers fs upload-zip <session_id> --zip ./archive.zip --dest-dir /tmp/extracted
```

### kernel browsers fs download-dir-zip

```bash
kernel browsers fs download-dir-zip <session_id> --path /tmp/data -o ./data.zip
```

### kernel browsers fs new-directory

```bash
kernel browsers fs new-directory <session_id> --path /tmp/newdir
kernel browsers fs new-directory <session_id> --path /tmp/newdir --mode 0755
```

### kernel browsers fs delete-file

```bash
kernel browsers fs delete-file <session_id> --path /tmp/file.txt
```

### kernel browsers fs delete-directory

```bash
kernel browsers fs delete-directory <session_id> --path /tmp/dir
```

### kernel browsers fs move

```bash
kernel browsers fs move <session_id> --src /tmp/old.txt --dest /tmp/new.txt
```

### kernel browsers fs set-permissions

```bash
kernel browsers fs set-permissions <session_id> --path /tmp/file.txt --mode 0755
kernel browsers fs set-permissions <session_id> --path /tmp/file.txt --owner user --group group
```

## Browser Logs

### kernel browsers logs stream

| Flag | Description |
|------|-------------|
| `--source` | Log source: path, supervisor (required) |
| `--follow` | Follow log stream |
| `--path` | File path (when source=path) |
| `--supervisor-process` | Process name (when source=supervisor) |

```bash
kernel browsers logs stream <session_id> --source supervisor --supervisor-process chromium --follow
kernel browsers logs stream <session_id> --source path --path /var/log/app.log --follow
```

## Replays

### kernel browsers replays list

```bash
kernel browsers replays list <session_id>
kernel browsers replays list <session_id> -o json
```

### kernel browsers replays start

| Flag | Description |
|------|-------------|
| `--framerate` | Recording FPS |
| `--max-duration` | Max duration in seconds |
| `--output`, `-o` | Output format: json |

```bash
kernel browsers replays start <session_id> -o json
kernel browsers replays start <session_id> --framerate 30 --max-duration 300 -o json
```

### kernel browsers replays stop

```bash
kernel browsers replays stop <session_id> <replay-id>
```

### kernel browsers replays download

```bash
kernel browsers replays download <session_id> <replay-id> -f ./video.webm
```
