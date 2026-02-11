---
name: kernel-managed-auth
description: Create and manage authenticated browser profiles with Kernel Managed Auth. Use when working with auth connections, login sessions, credential providers, or keeping browser profiles logged into websites. Covers CLI commands (kernel auth connections), SDK methods (kernel.auth.connections.*), hosted UI flows, programmatic credential submission, SSO/OAuth, 2FA/MFA handling, health checks, and re-authentication.
---

# Kernel Managed Auth

Managed Auth creates and maintains authenticated browser profiles. Store credentials once, and Kernel re-authenticates automatically when sessions expire. Launch browsers with managed profiles and they're already logged in.

## Core Concepts

- **Connection** (`auth.connections`) - Links a profile to a domain. One per profile+domain pair.
- **Session** - A login flow on a connection. Started via `login()`, progresses through steps (DISCOVERING → AWAITING_INPUT → SUBMITTING → COMPLETED).
- **Profile** - Persistent browser state (cookies, local storage). Created automatically if it doesn't exist.
- **Credential** - Stored login values (encrypted, never exposed in API responses or to LLMs).

## Quick Start (CLI)

```bash
# Create a connection
kernel auth connections create --domain github.com --profile-name my-github

# Start login (returns hosted URL)
kernel auth connections login <connection_id>

# Follow login events in real time
kernel auth connections follow <connection_id>

# Use the authenticated profile
kernel browsers create --profile my-github --stealth
```

## Quick Start (SDK)

```typescript
const auth = await kernel.auth.connections.create({
  domain: 'github.com',
  profile_name: 'my-github',
});

const login = await kernel.auth.connections.login(auth.id);
console.log('Login URL:', login.hosted_url);

// Poll until done
let state = await kernel.auth.connections.retrieve(auth.id);
while (state.flow_status === 'IN_PROGRESS') {
  await new Promise(r => setTimeout(r, 2000));
  state = await kernel.auth.connections.retrieve(auth.id);
}

// Launch authenticated browser
const browser = await kernel.browsers.create({
  profile: { name: 'my-github' },
  stealth: true,
});
```

## References

- [CLI Commands](./references/cli-commands.md) - All `kernel auth connections` commands and flags
- [SDK & Programmatic Flow](./references/sdk-programmatic.md) - SDK methods, polling, field submission, SSO, MFA, SSE streaming, credential providers
