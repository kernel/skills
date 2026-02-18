# Kernel Skills

Official AI agent skills from the Kernel for installing useful skills for our CLI and SDKs that you can load into popular coding agents.

## Installation

### Claude Code

```bash
# Add the Kernel skills marketplace
/plugin marketplace add kernel/skills

# Install the CLI skill
/plugin install kernel-cli

# Install the Auth skill
/plugin install kernel-auth

# Install the SDK skills (TypeScript & Python)
/plugin install kernel-sdks
```

### Any Agent
```bash
npx skills add kernel/skills
```

### Manual Installation

```bash
git clone https://github.com/kernel/skills.git
cp -r skills/plugins/kernel-cli ~/.claude/skills/
cp -r skills/plugins/kernel-auth ~/.claude/skills/
cp -r skills/plugins/kernel-sdks ~/.claude/skills/
```

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

Once installed, your coding agent will automatically know how to use Kernel.

## Available Skills

### kernel-cli

Command-line interface skills for using Kernel CLI commands.

| Skill | Description |
|-------|-------------|
| **kernel-cli** | Complete guide to Kernel CLI - cloud browser platform with automation, deployment, and management |
| **kernel-agent-browser** | Best practices for `agent-browser -p kernel` automation, bot detection handling, iframes, login persistence |

### kernel-auth

Setup and manage authentication for services like Gmail, GitHub, Outlook with Kernel's managed auth system.

| Skill | Description |
|-------|-------------|
| **kernel-auth** | Setup and manage Kernel authentication connections with safety checks and reauthentication support |

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
