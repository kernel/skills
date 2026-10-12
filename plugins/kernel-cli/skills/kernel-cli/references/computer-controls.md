---
name: kernel-computer-controls
description: os-level mouse, keyboard, screen control, and screenshots for browser automation
---

# computer controls

os-level mouse, keyboard, and screen control for precise browser interaction.

## when to use

computer controls provide **os-level** interaction with the browser vm, operating at the system level rather than through browser apis. use computer controls when:

- **Playwright/cdp isn't sufficient**: when you need to interact with elements that are difficult to target via dom selectors
- **testing real user behavior**: simulating actual mouse movements, clicks, and keyboard input as a human would perform them
- **interacting with browser ui**: clicking on browser chrome elements (address bar, extensions, menus) that aren't accessible via page automation
- **handling complex interactions**: drag-and-drop operations, hover effects, or interactions that require precise coordinate-based control
- **capturing visual output**: taking screenshots of the entire browser viewport or specific screen regions
- **working with canvas/WebGL**: interacting with canvas elements or games where dom-based automation doesn't work
- **bypassing automation detection**: some anti-bot systems detect Playwright/cdp usage but not os-level input

**when NOT to use computer controls:**
- for standard web automation (form filling, clicking buttons) - use `kernel browsers playwright execute` instead for better reliability and speed
- when you need to access page content or execute JavaScript - use Playwright execution
- for headless browsers - computer controls require a gui environment

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## screenshots

### full screenshot

```bash
kernel browsers computer screenshot <session_id> --to screenshot.png
```

### region screenshot

```bash
kernel browsers computer screenshot <session_id> --to region.png --x 0 --y 0 --width 800 --height 600
```

## mouse actions

### click

```bash
# Left click
kernel browsers computer click-mouse <session_id> --x 100 --y 200

# Right click (double)
kernel browsers computer click-mouse <session_id> --x 100 --y 200 --button right --num-clicks 2
```

### move

```bash
kernel browsers computer move-mouse <session_id> --x 500 --y 300
```

### drag

```bash
kernel browsers computer drag-mouse <session_id> --point 100,200 --point 200,300 --button left
```

### scroll

```bash
kernel browsers computer scroll <session_id> --x 300 --y 400 --delta-y 120
```

## keyboard actions

### type text

```bash
# Fast typing
kernel browsers computer type <session_id> --text "Hello, World!"

# Slow typing (100ms delay between chars)
kernel browsers computer type <session_id> --text "Slow typing" --delay 100
```

### press keys

key names follow [X11 keysym definitions](https://www.cl.cam.ac.uk/~mgk25/ucs/keysymdef.h). common keys include: `Return`, `Tab`, `Escape`, `BackSpace`, `Delete`, `Home`, `End`, `Page_Up`, `Page_Down`, `Up`, `Down`, `Left`, `Right`, `Shift_L`, `Control_L`, `Alt_L`, etc.

```bash
# Single key
kernel browsers computer press-key <session_id> --key Return

# Key combination
kernel browsers computer press-key <session_id> --key Control_L+t

# Complex combination with held keys
kernel browsers computer press-key <session_id> --key Control_L+Shift_L+Tab --hold-key Alt_L
```

## common pattern: navigate and screenshot

```bash
SESSION=$(kernel browsers create -o json | jq -r '.session_id')

# Navigate using Playwright
kernel browsers playwright execute $SESSION 'await page.goto("https://kernel.sh")'

# Take screenshot
kernel browsers computer screenshot $SESSION --to kernel-homepage.png

# Cleanup
kernel browsers delete $SESSION
```

**mcp tool:** use `kernel:execute_playwright_code` and `kernel:take_screenshot` for Playwright execution and screenshots.
