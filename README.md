# Kernel Skills

Official agent skills for [Kernel](https://www.kernel.sh), the cloud browser platform for AI agents. Install them once and your coding agent knows how to create browsers, run Playwright, handle auth, use Vault, pick regions, record replays, and deploy apps with the Kernel CLI and SDKs.

## Get started in two steps

**1. Add the skills to your agent**

```bash
npx skills add kernel/skills
```

Works with any agent that supports the [skills.sh](https://skills.sh) format (Claude Code, Codex, Cursor, OpenClaw, and others).

**2. Set up Kernel**

```bash
brew install kernel/tap/kernel        # or: npm install -g @onkernel/cli
kernel login                          # or: export KERNEL_API_KEY=<api-key>
```

Then ask your agent for something like "create a stealth Kernel browser in eu-west and check out with the card in vault user-12345". The relevant skills load automatically.

Looking for end-to-end examples? See [kernel/cookbooks](https://github.com/kernel/cookbooks); every cookbook lists the skills it uses.

## Available skills

### kernel-cli plugin

| Skill | Use it when |
| --- | --- |
| **kernel-cli** | Any `kernel ...` command: browsers, profiles, proxies, pools, extensions, replays, computer controls, filesystem, process execution, app deployment |
| **kernel-agent-browser** | Automating sites with `agent-browser -p kernel`: selectors, waits, iframes, stealth, live view, session cleanup |
| **kernel-auth** | A task needs an authenticated website session. Managed auth connections, hosted login, reauth, profile-backed browsers |
| **kernel-vault** | A task needs a credential or payment card the agent must never see. Vaults, credential fill, wallet/card items, HITL collection and approval, alias-based checkout |
| **kernel-regions** | Latency matters. `region` on browsers and pools (`us-east`, `eu-west`, `ap-southeast`), choosing a region, pairing with proxies, what stays global |
| **kernel-browser-harness** | Building a repeatable harness around Kernel browsers |
| **profile-website-bot-detection** | Profiling a site's bot-detection vendors with stealth vs non-stealth browsers |
| **debug-browser-session** | A browser session misbehaves: VM, network, Chrome crash, page load, live view issues |
| **diff-profile-archives** | Comparing two downloaded profile archives |

### kernel-sdks plugin

| Skill | Use it when |
| --- | --- |
| **kernel-typescript-sdk** | Writing automation with `@onkernel/sdk` |
| **kernel-python-sdk** | Writing automation with the `kernel` Python package |

### generate-video plugin

| Skill | Use it when |
| --- | --- |
| **generate-video** | Rendering judder-free MP4s from web pages or animations with headless Chromium and ffmpeg. No Kernel account required |

## Other install methods

### Claude Code plugin marketplace

```bash
/plugin marketplace add kernel/skills
/plugin install kernel-cli        # includes kernel-auth, kernel-vault, kernel-regions
/plugin install kernel-sdks
/plugin install generate-video
```

### Codex

```bash
codex plugin marketplace add kernel/skills
codex plugin add kernel-cli@kernel
codex plugin add kernel-sdks@kernel
codex plugin add generate-video@kernel
```

You can also install from the Plugins Directory in the ChatGPT desktop app. Restart the app after adding the marketplace, open **Plugins** in Codex, and find the Kernel plugins under **Public**.

### Cursor

1. Open Cursor Settings > Plugins
2. Search for "Kernel"
3. Install the plugin

The Cursor plugin includes all skills, an MCP server for cloud browser management, and best-practice rules.

### Manual

```bash
git clone https://github.com/kernel/skills.git
cp -r skills/plugins/kernel-cli ~/.claude/skills/
cp -r skills/plugins/kernel-sdks ~/.claude/skills/
cp -r skills/plugins/generate-video ~/.claude/skills/
```

## Documentation

- [Kernel Documentation](https://www.kernel.sh/docs)
- [Agent-readable docs index](https://kernel.sh/docs/llms.txt)
- [CLI Reference](https://www.kernel.sh/docs/reference/cli)
- [API Reference](https://www.kernel.sh/docs/api-reference)
- [Quickstart Guide](https://www.kernel.sh/docs/quickstart)
- [Cookbooks](https://github.com/kernel/cookbooks)

## Support

- [Discord Community](https://discord.gg/FBrveQRcud)
- [GitHub Issues](https://github.com/kernel/skills/issues)

## License
MIT
