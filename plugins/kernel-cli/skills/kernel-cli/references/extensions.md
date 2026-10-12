---
name: kernel-extensions
description: upload, manage, and download Chrome extensions for KERNEL browsers
---

# Extensions

manage Chrome extensions for your KERNEL browsers.

## when to use

use this skill when you need to:
- **block ads or trackers** during web scraping to improve performance
- **auto-login to websites** using authentication extensionsz
- **test browser extensions** in automated environments
- **add custom functionality** to browsers via extensions
- **download extensions** from Chrome Web Store for use with KERNEL
- **manage extension lifecycle** (upload, list, download, delete)

## prerequisites

see [prerequisites.md](../../reference/prerequisites.md) for KERNEL cli setup.

## list extensions

view all extensions in your organization:

```bash
kernel extensions list
```

with json output:

```bash
kernel extensions list -o json
```

## upload extension

upload an unpacked extension directory:

```bash
kernel extensions upload ./my-extension

# Upload with custom name
kernel extensions upload ./my-extension --name my-ext

# Upload with JSON output
kernel extensions upload ./my-extension --name my-ext -o json
```

## download extension from Chrome Web Store

download and unpack an extension directly from the Chrome Web Store:

```bash
kernel extensions download-web-store "https://chromewebstore.google.com/detail/extension-id" --to ./my-extension

# Specify target OS (mac, win, or linux)
# If uploading to a kernel browser, the target OS should be linux
kernel extensions download-web-store "https://chromewebstore.google.com/detail/extension-id" --to ./my-extension --os mac
```

## download extension

download and extract an extension by id or name to a directory:

```bash
kernel extensions download my-ext --to ./downloaded
```

**note:** the extension will be extracted to the specified directory (not saved as a zip file).

## delete extension

```bash
# Delete with confirmation prompt
kernel extensions delete my-ext

# Delete without confirmation
kernel extensions delete my-ext --yes
```

## example: download and upload AdGuard extension
```bash
# 1. Download AdGuard from Chrome Web Store
kernel extensions download-web-store \
  "https://chromewebstore.google.com/detail/adguard-adblocker/bgnkhhnnamicmpeenaelnjfhikgbkllg" \
  --to ./extensions/adguard

# 2. Upload to Kernel
kernel extensions upload ./extensions/adguard --name adguard

# 3. Create a browser with the extension
kernel browsers create --extension adguard -o json

# 4. Verify upload
kernel extensions list
```

## example: use extension with browser

after uploading an extension, you can use it with browsers. see the browser management commands for details on loading extensions into browser sessions.

```bash
# Create browser with extension
SESSION=$(kernel browsers create -o json | jq -r '.session_id')

# Use browser with automation
kernel browsers playwright execute $SESSION 'await page.goto("https://example.com")'
```

**mcp tool:** use `kernel:execute_playwright_code` for Playwright execution.

## use cases

- **ad blocking**: block ads during web scraping
- **authentication**: use auto-login extensions
- **testing**: test browser extension functionality
- **custom automation**: deploy custom extensions
