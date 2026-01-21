---
name: kernel-cli
description: Kernel CLI installation, authentication, and core setup
---

# Kernel CLI

The Kernel CLI provides command-line access to Kernel's cloud browser platform.

## Installation

- Homebrew: `brew install kernel/tap/kernel`(>=v0.13.4)
- npm: `npm install -g @onkernel/cli` (>=v0.13.4)

## Authentication

- **Preferred:** Set `KERNEL_API_KEY` environment variable
- **Fallback:** Run `kernel login` for interactive OAuth

## Available Commands

- **Browser Management** - Create, list, delete browser sessions
- **App Deployment** - Deploy and invoke serverless apps
- **Computer Controls** - Mouse, keyboard, screenshots
- **Process Execution** - Run commands in browser VMs
- **Profiles** - Persistent browser profiles
- **Proxies** - Proxy configuration
- **Browser Pools** - Pre-warmed browser pools
- **Extensions** - Chrome extension management
- **Replays** - Video recording
