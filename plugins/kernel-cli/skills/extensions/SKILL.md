---
name: kernel-extensions
description: Upload, manage, and download Chrome extensions for Kernel browsers
---

# Extensions

Manage Chrome extensions for your Kernel browsers.

## When to Use

Use this skill when you need to:
- **Block ads or trackers** during web scraping to improve performance
- **Auto-login to websites** using authentication extensionsz
- **Test browser extensions** in automated environments
- **Add custom functionality** to browsers via extensions
- **Download extensions** from Chrome Web Store for use with Kernel
- **Manage extension lifecycle** (upload, list, download, delete)

## Prerequisites

See [prerequisites.md](../../reference/prerequisites.md) for Kernel CLI setup.

## List Extensions

View all extensions in your organization:

```bash
kernel extensions list
```

With JSON output:

```bash
kernel extensions list -o json
```

## Upload Extension

Upload an unpacked extension directory:

```bash
kernel extensions upload ./my-extension

# Upload with custom name
kernel extensions upload ./my-extension --name my-ext

# Upload with JSON output
kernel extensions upload ./my-extension --name my-ext -o json
```

## Download Extension from Chrome Web Store

Download and unpack an extension directly from the Chrome Web Store:

```bash
kernel extensions download-web-store "https://chromewebstore.google.com/detail/extension-id" --to ./my-extension

# Specify target OS (mac, win, or linux)
kernel extensions download-web-store "https://chromewebstore.google.com/detail/extension-id" --to ./my-extension --os mac
```

## Download Extension

Download and extract an extension by ID or name to a directory:

```bash
kernel extensions download my-ext --to ./downloaded
```

**Note:** The extension will be extracted to the specified directory (not saved as a zip file).

## Delete Extension

```bash
# Delete with confirmation prompt
kernel extensions delete my-ext

# Delete without confirmation
kernel extensions delete my-ext --yes
```

## Example: Download and Upload AdBlock Extension

```bash
# Download extension from Chrome Web Store
kernel extensions download-web-store "https://chromewebstore.google.com/detail/adblock-extension-id" --to ./adblock

# Upload to Kernel
kernel extensions upload ./adblock --name adblock

# Verify upload
kernel extensions list
```

## Example: Use Extension with Browser

After uploading an extension, you can use it with browsers. See the browser management commands for details on loading extensions into browser sessions.

```bash
# Create browser with extension
SESSION=$(kernel browsers create -o json | jq -r '.session_id')

# Use browser with automation
kernel browsers playwright execute $SESSION 'await page.goto("https://example.com")'
```

**MCP Tool:** Use `kernel:execute_playwright_code` for playwright execution.

## Use Cases

- **Ad blocking**: Block ads during web scraping
- **Authentication**: Use auto-login extensions
- **Testing**: Test browser extension functionality
- **Custom automation**: Deploy custom extensions
- **Bot detection bypass**: Use Web Bot Auth for RFC 9421 signatures
