# KERNEL plugin for grok build

cloud browsers for grok build, served over KERNEL's hosted mcp server. grok launches stealth chromium sessions in <30ms, drives them with playwright, a persistent browser repl, or computer-use actions, reuses logged-in profiles and managed auth connections, and records replays.

## install

in grok build, run `/plugin`, search for **kernel**, and install it. or from a shell:

```bash
grok plugin install kernel --trust
```

## what's inside

| component | path | purpose |
|---|---|---|
| mcp server | `.mcp.json` | our hosted mcp server at `https://mcp.onkernel.com/mcp` (streamable http) |
| skill | `skills/kernel-mcp/SKILL.md` | when and how grok should use the KERNEL mcp tools |

## auth and network access

the plugin carries no api key. on first connection, grok opens a browser window so you can sign in to KERNEL over oauth 2.1. during authorization you can grant org-wide access or limit it to one KERNEL project.

the plugin only talks to `https://mcp.onkernel.com`. it runs no local code, hooks, or install scripts. browsers run in our cloud and bill to the KERNEL account you sign in with.

the mcp server is open source: [kernel/kernel-mcp-server](https://github.com/kernel/kernel-mcp-server).

## license

mit
