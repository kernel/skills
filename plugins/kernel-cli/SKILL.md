---
name: kernel-cli
description: Kernel CLI installation, authentication, and core setup
---

# Kernel CLI

The Kernel CLI provides command-line access to Kernel's cloud browser platform.

## Installation

- Homebrew: `brew install kernel/tap/kernel` (>=v0.13.4)
- npm: `npm install -g @onkernel/cli` (>=v0.13.4)

## Authentication

- **Preferred:** Set `KERNEL_API_KEY` environment variable
- **Fallback:** Run `kernel login` for interactive OAuth

## Available Commands

| Command Area | Skill Name | Description |
|--------------|------------|-------------|
| **Browser Management** | `kernel-browser-management` | Create, list, delete browser sessions |
| **App Deployment** | `kernel-app-deployment` | Deploy and invoke serverless apps |
| **Computer Controls** | `kernel-computer-controls` | Mouse, keyboard, screenshots |
| **Process Execution** | `kernel-process-execution` | Run commands in browser VMs |
| **Profiles** | `kernel-profiles` | Persistent browser profiles |
| **Proxies** | `kernel-proxies` | Proxy configuration |
| **Browser Pools** | `kernel-browser-pools` | Pre-warmed browser pools |
| **Extensions** | `kernel-extensions` | Chrome extension management |
| **Replays** | `kernel-replays` | Video recording |
