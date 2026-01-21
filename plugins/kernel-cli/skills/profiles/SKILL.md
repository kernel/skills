---
name: kernel-profiles
description: Create and manage persistent browser profiles to preserve cookies, local storage, and session state
---

# Profiles

Profiles store persistent browser state including cookies, local storage, and browser history.

## When to Use

Use profiles for:
- **Persistent login state** - Stay logged into websites across browser sessions
- **Site preferences** - Preserve user settings and configurations
- **Testing with authentication** - Test authenticated flows without re-logging in
- **Multi-account management** - Maintain separate profiles for different accounts
- **Session reuse** - Avoid repeated authentication flows in automation
- **Cookie management** - Preserve and reuse cookies across sessions

## Prerequisites

Load the `/kernel-cli` skill for Kernel CLI installation and authentication.

## Create Profile

```bash
# Create with a unique name
kernel profiles create --name my-profile

# Create without a name (auto-generated ID)
kernel profiles create
```

## List Profiles

```bash
kernel profiles list -o json
```

**MCP Tool:** Use `kernel:list_profiles`.

## Get Profile Details

```bash
# Get by name
kernel profiles get my-profile
```

## Delete Profile

```bash
# Delete with confirmation prompt
kernel profiles delete my-profile
```

**MCP Tool:** Use `kernel:delete_profile`.

## Download Profile

```bash
# Download profile data as ZIP
kernel profiles download my-profile --to profile.zip
```

The downloaded file contains the profile's cookies and local storage data.
