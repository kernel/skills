# Kernel Skills

Official AI agent skills from the Kernel for installing useful skills for our CLI and SDKs that you can load into popular coding agents.

## Installation

### Claude Code

```bash
# Add the Kernel skills marketplace
/plugin marketplace add kernel/skills

# Install the CLI skill
/plugin install kernel-cli

# Install the SDK skills (TypeScript & Python)
/plugin install kernel-sdks
```

### Manual Installation

```bash
git clone https://github.com/kernel/skills.git
cp -r skills/plugins/kernel-cli ~/.claude/skills/
cp -r skills/plugins/kernel-sdks ~/.claude/skills/
```

## Usage Examples

## Prerequisites

Before using these skills, ensure you have:

1. **Kernel CLI installed**:
   ```bash
   brew install kernel/tap/kernel
   ```

2. **Authenticated with Kernel**:
   ```bash
   export KERNEL_API_KEY=<api-key> or
   kernel login
   ```

## Available Skills

### kernel-cli

Command-line interface skills for using Kernel CLI commands.

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

### kernel-sdks

SDK skills for building browser automation with TypeScript and Python.

| Skill | Description |
|-------|-------------|
| **typescript-sdk** | Build automation with Kernel's Typescript SDK |
| **python-sdk** | Build automation with kernel's Python SDK |

## Documentation

- [Kernel Documentation](https://www.kernel.sh/docs)
- [CLI Reference](https://www.kernel.sh/docs/reference/cli)
- [API Reference](https://www.kernel.sh/docs/api-reference)
- [Quickstart Guide](https://www.kernel.sh/docs/quickstart)

## Support

- [Discord Community](https://discord.gg/FBrveQRcud)
- [GitHub Issues](https://github.com/kernel/skills/issues)

## License
MIT
