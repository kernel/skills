# Kernel plugin for Grok Build

Gives Grok Build cloud browsers through Kernel's hosted MCP server. Grok can launch stealth Chromium sessions, drive them with Playwright, the Browser REPL, or computer-use actions, reuse logged-in profiles and managed auth connections, and record replays.

## Install

In Grok Build, run `/plugin`, search for **kernel**, and install it. Or from a shell:

```bash
grok plugin install kernel --trust
```

## What it contains

| Component | Path | Purpose |
|---|---|---|
| MCP server | `.mcp.json` | Kernel's hosted MCP server at `https://mcp.onkernel.com/mcp` (streamable HTTP) |
| Skill | `skills/kernel-mcp/SKILL.md` | When and how to use the Kernel MCP tools |

## Authentication and network access

The plugin carries no API key. On first connection Grok opens a browser window to sign in to Kernel over OAuth 2.1. During authorization you can grant org-wide access or limit it to one Kernel project.

The plugin only talks to `https://mcp.onkernel.com`. It runs no local code, hooks, or install scripts. Browsers run in Kernel's cloud and are billed to the Kernel account you sign in with.

The MCP server is open source: [kernel/kernel-mcp-server](https://github.com/kernel/kernel-mcp-server).

## License

MIT
