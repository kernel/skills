# Kernel CLI Prerequisites

All Kernel CLI skills require the following setup:

## Installation

- Kernel CLI installed: `brew install kernel/tap/kernel` or `npm install -g @onkernel/cli` >=v0.13.4
  - Optionally the Kernel MCP server

## Authentication

- **Preferred:** Set `KERNEL_API_KEY` environment variable (non-interactive)
- **Fallback:** Run `kernel login` for interactive authentication
