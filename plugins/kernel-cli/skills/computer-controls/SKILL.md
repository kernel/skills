---
name: kernel-computer-controls
description: OS-level mouse, keyboard, screen control, and screenshots for browser automation
---

# Computer Controls

OS-level mouse, keyboard, and screen control for precise browser interaction.

## When to Use

Computer controls provide **OS-level** interaction with the browser VM, operating at the system level rather than through browser APIs. Use computer controls when:

- **Playwright/CDP isn't sufficient**: When you need to interact with elements that are difficult to target via DOM selectors
- **Testing real user behavior**: Simulating actual mouse movements, clicks, and keyboard input as a human would perform them
- **Interacting with browser UI**: Clicking on browser chrome elements (address bar, extensions, menus) that aren't accessible via page automation
- **Handling complex interactions**: Drag-and-drop operations, hover effects, or interactions that require precise coordinate-based control
- **Capturing visual output**: Taking screenshots of the entire browser viewport or specific screen regions
- **Working with canvas/WebGL**: Interacting with canvas elements or games where DOM-based automation doesn't work
- **Bypassing automation detection**: Some anti-bot systems detect Playwright/CDP usage but not OS-level input

**When NOT to use computer controls:**
- For standard web automation (form filling, clicking buttons) - use `kernel browsers playwright execute` instead for better reliability and speed
- When you need to access page content or execute JavaScript - use Playwright execution
- For headless browsers - computer controls require a GUI environment

## Prerequisites

Load the `kernel-cli` skill for Kernel CLI installation and authentication.

## Screenshots

### Full Screenshot

```bash
kernel browsers computer screenshot <session_id> --to screenshot.png
```

### Region Screenshot

```bash
kernel browsers computer screenshot <session_id> --to region.png --x 0 --y 0 --width 800 --height 600
```

## Mouse Actions

### Click

```bash
# Left click
kernel browsers computer click-mouse <session_id> --x 100 --y 200

# Right click (double)
kernel browsers computer click-mouse <session_id> --x 100 --y 200 --button right --num-clicks 2
```

### Move

```bash
kernel browsers computer move-mouse <session_id> --x 500 --y 300
```

### Drag

```bash
kernel browsers computer drag-mouse <session_id> --point 100,200 --point 200,300 --button left
```

### Scroll

```bash
kernel browsers computer scroll <session_id> --x 300 --y 400 --delta-y 120
```

## Keyboard Actions

### Type Text

```bash
# Fast typing
kernel browsers computer type <session_id> --text "Hello, World!"

# Slow typing (100ms delay between chars)
kernel browsers computer type <session_id> --text "Slow typing" --delay 100
```

### Press Keys

```bash
# Single key
kernel browsers computer press-key <session_id> --key Enter

# Key combination
kernel browsers computer press-key <session_id> --key Ctrl+t

# Complex combination with held keys
kernel browsers computer press-key <session_id> --key Ctrl+Shift+Tab --hold-key Alt
```

## Common Pattern: Navigate and Screenshot

```bash
SESSION=$(kernel browsers create -o json | jq -r '.session_id')

# Navigate using Playwright
kernel browsers playwright execute $SESSION 'await page.goto("https://kernel.sh")'

# Take screenshot
kernel browsers computer screenshot $SESSION --to kernel-homepage.png

# Cleanup
kernel browsers delete $SESSION --yes
```

**MCP Tool:** Use `kernel:execute_playwright_code` and `kernel:take_screenshot` for playwright execution and screenshots.
