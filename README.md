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

### Any Agent
```bash
npx skills add kernel/skills
```

### Manual Installation

```bash
git clone https://github.com/kernel/skills.git
cp -r skills/plugins/kernel-cli ~/.claude/skills/
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
   kernel login
   ```

Once installed, your coding agent will automatically know how to use Kernel.

## Skill Structure

| Skill | Description |
|-------|-------------|
| **kernel-cli** | Complete guide to Kernel CLI - cloud browser platform with automation, deployment, and management |

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
