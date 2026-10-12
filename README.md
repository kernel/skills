# KERNEL skills

official ai agent skills from the KERNEL for installing useful skills for our cli and sdks that you can load into popular coding agents.

## installation

### Claude Code

```bash
# Add the Kernel skills marketplace
/plugin marketplace add kernel/skills

# Install the CLI skill (includes kernel-auth)
/plugin install kernel-cli

# Install the SDK skills (TypeScript & Python)
/plugin install kernel-sdks

# Install the video generation skill
/plugin install generate-video
```

### Codex

```bash
# Add the Kernel plugin marketplace
codex plugin marketplace add kernel/skills

# Install one or more plugins
codex plugin add kernel-cli@kernel
codex plugin add kernel-sdks@kernel
codex plugin add generate-video@kernel
```

you can also install them from the Plugins Directory in the ChatGPT desktop app. restart the app after adding the marketplace, open **plugins** in Codex, and find the KERNEL plugins under **public**.

### Cursor

the KERNEL plugin for Cursor lives in [kernel/cursor-plugin](https://github.com/kernel/cursor-plugin). it bundles KERNEL's hosted mcp server with a skill for using its tools. see that repo's README for install steps.

### Grok Build

install from the Grok Build plugin marketplace:

```bash
/plugin  # search "kernel" and install
```

the Grok plugin lives in [`grok/`](grok) and bundles KERNEL's hosted mcp server with a skill for using its tools.

### any agent
```bash
npx skills add kernel/skills
```

### manual installation

```bash
git clone https://github.com/kernel/skills.git
cp -r skills/plugins/kernel-cli ~/.claude/skills/
cp -r skills/plugins/kernel-sdks ~/.claude/skills/
cp -r skills/plugins/generate-video ~/.claude/skills/
```

## prerequisites

before using these skills, ensure you have:

1. **KERNEL cli installed**:
   ```bash
   brew install kernel/tap/kernel
   ```

2. **authenticated with KERNEL**:
   ```bash
   export KERNEL_API_KEY=<api-key> or
   kernel login
   ```

once installed, your coding agent will automatically know how to use KERNEL.

## available skills

### kernel-cli

command-line interface skills for using KERNEL cli commands.

| skill | description |
|-------|-------------|
| **kernel-cli** | complete guide to KERNEL cli - cloud browser platform with automation, deployment, and management |
| **kernel-agent-browser** | best practices for `agent-browser -p kernel` automation, bot detection handling, iframes, login persistence |
| **create-agent-site-skill** | build a new site-specific automation skill backed by a KERNEL cloud browser, using KERNEL's own cli primitives by default |
| **kernel-auth** | setup and manage KERNEL authentication connections for any website with safety checks and reauthentication support, plus per-user vault credentials through KERNEL-hosted collection or 1Password brokered approval |
| **profile-website-bot-detection** | profile a website for bot detection vendors using stealth vs non-stealth KERNEL browsers; compare effectiveness and identify vendor products |
| **debug-browser-session** | systematically debug a KERNEL browser session — vm issues, network errors, Chrome crashes, page-load failures, and live-view problems — using the KERNEL cli |

### kernel-sdks

sdk skills for building browser automation with TypeScript and Python.

| skill | description |
|-------|-------------|
| **typescript-sdk** | build automation with KERNEL's TypeScript sdk |
| **python-sdk** | build automation with kernel's Python sdk |

### generate-video

render smooth, deterministic mp4s from web scenes. no KERNEL account required — just Chromium, Node, and ffmpeg.

| skill | description |
|-------|-------------|
| **generate-video** | generate judder-free mp4 videos from web pages and animated visualizations: drive headless Chromium over cdp with an injected virtual clock, capture exact per-frame pngs, encode with ffmpeg |

## documentation

- [KERNEL documentation](https://www.kernel.sh/docs)
- [cli reference](https://www.kernel.sh/docs/reference/cli)
- [api reference](https://www.kernel.sh/docs/api-reference)
- [quickstart guide](https://www.kernel.sh/docs/quickstart)

## support

- [Discord community](https://discord.gg/FBrveQRcud)
- [GitHub issues](https://github.com/kernel/skills/issues)

## license
MIT
