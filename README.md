<p align="center">
  <img src="https://raw.githubusercontent.com/onkernel/kernel-images/main/static/images/Kernel-Wordmark_Accent.svg" alt="Kernel Logo" width="55%">
</p>

<p align="center">
  <strong>Skills for AI Coding Agents</strong>
</p>


# Kernel Skills

Official AI agent skills from the Kernel for installing useful skills for our CLI and SDKs that you can load into popular coding agents.

## Installation

### Claude Code

```bash
# Add the Kernel skills marketplace
/plugin marketplace add kernel/skills

# Install the CLI skill
/plugin install kernel-cli
```

### Any Agent (using bunx)

```bash
# Using add-skill
bunx add-skill onkernel/skills
```

### Manual Installation

```bash
git clone https://github.com/onkernel/skills.git
cp -r skills/plugins/kernel-cli ~/.claude/skills/
```

## Usage Examples

## Prerequisites

Before using these skills, ensure you have:

1. **Kernel CLI installed**:
   ```bash
   brew install onkernel/tap/kernel
   ```

2. **Authenticated with Kernel**:
   ```bash
   kernel login
   ```

Once installed, your coding agent will automatically know how to use Kernel. Try prompts like:

### CLI Usage

> "Spin up a browser and take a screenshot of kernel.sh"

Your agent will respond with:

```bash
kernel browsers create -o json
# Extract session_id from output
kernel browsers computer screenshot <session_id> --to screenshot.png
```

## Skill Structure

The kernel-cli skill is organized into focused sub-skills:

| Skill | Description |
|-------|-------------|
| **browser-management** | Browser creation, listing, deletion |
| **playwright-execution** | Playwright code execution |
| **computer-controls** | Mouse, keyboard, screenshots |
| **app-deployment** | Deploy and invoke apps |
| **browser-pools** | Pre-warmed browser pools |
| **profiles** | Persistent browser state |
| **extensions** | Chrome extension management |
| **proxies** | Proxy configuration |
| **process-execution** | VM process execution |
| **filesystem-ops** | File operations |
| **replays** | Video recording |

**Reference Documentation:**
- `commands.md` - Complete CLI reference

Each sub-skill is loaded contextually based on your prompts, minimizing token usage while providing comprehensive Kernel knowledge.

## Documentation

- [Kernel Documentation](https://www.kernel.sh/docs)
- [CLI Reference](https://www.kernel.sh/docs/reference/cli)
- [API Reference](https://www.kernel.sh/docs/api-reference)
- [Quickstart Guide](https://www.kernel.sh/docs/quickstart)

## Support

- [Discord Community](https://discord.gg/FBrveQRcud)
- [GitHub Issues](https://github.com/onkernel/skills/issues)

## License
MIT
