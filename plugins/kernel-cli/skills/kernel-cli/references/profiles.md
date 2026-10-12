---
name: kernel-profiles
description: create and manage persistent browser profiles to preserve cookies, local storage, and session state
---

# Profiles

profiles store persistent browser state including cookies, local storage, and browser history.

## when to use

use profiles for:
- **persistent login state** - stay logged into websites across browser sessions
- **site preferences** - preserve user settings and configurations
- **testing with authentication** - test authenticated flows without re-logging in
- **multi-account management** - maintain separate profiles for different accounts
- **session reuse** - avoid repeated authentication flows in automation
- **cookie management** - preserve and reuse cookies across sessions

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## create profile

```bash
# Create with a unique name
kernel profiles create --name my-profile

# Create without a name (auto-generated ID)
kernel profiles create
```

## list profiles

```bash
kernel profiles list -o json
```

**mcp tool:** use `kernel:list_profiles`.

## get and rename a profile

```bash
# Get by name
kernel profiles get my-profile -o json

# Rename by ID or name; names must be unique in the project
kernel profiles update my-profile --name renamed-profile -o json
```

## download profile

```bash
# Request the default compressed tar.zst archive and extract it into a directory
kernel profiles download renamed-profile --to ./profile-data

# Ask the server to decompress the archive before transfer; output is still a directory
kernel profiles download renamed-profile --to ./profile-data-tar --format tar
```

`--to` is an extraction directory, not an archive filename; the cli creates it if needed. supported request formats are `tar.zst` (default) and `tar`.

## delete profile

```bash
# Delete with confirmation prompt
kernel profiles delete renamed-profile
```

**mcp tool:** use `kernel:delete_profile`.
