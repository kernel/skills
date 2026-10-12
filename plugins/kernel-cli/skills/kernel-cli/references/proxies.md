---
name: kernel-proxies
description: create and manage datacenter, isp, residential, mobile, and custom proxies for browsers
---

# proxies

route browser traffic through proxies for geo-location, privacy, or testing.

## when to use

KERNEL proxies enable you to route browser traffic through different types of proxy servers, providing enhanced privacy, flexibility, and bot detection avoidance. proxies can be created once and reused across multiple browser sessions.

## prerequisites

load the `kernel-cli` skill for KERNEL cli installation and authentication.

## proxy types

1. **datacenter** - traffic routed through commercial data centers (fastest speed)
2. **isp** - traffic routed through data centers, using residential ip addresses leased from isps (balance between speed and detection)
3. **residential** - traffic routed through real residential ip addresses (least detectable)
4. **mobile** - traffic routed through mobile carrier networks
5. **custom** - your own proxy servers

## create proxies

### datacenter proxy

```bash
# Create datacenter proxy
kernel proxies create --type datacenter --country US --name "US DC"

# With protocol specification
kernel proxies create --type datacenter --country US --protocol https
```

### isp proxy

balance of speed and legitimacy using isp-assigned ips.

```bash
# Create ISP proxy
kernel proxies create --type isp --country US --name "US ISP"
```

### residential proxy

real residential ip addresses with advanced targeting options.

```bash
# Basic residential proxy
kernel proxies create --type residential --country US --name "US Residential"

# With city targeting (requires country)
kernel proxies create --type residential --country US --city sanfrancisco --state CA

# With ZIP code (US only)
kernel proxies create --type residential --country US --zip 94102

# With ASN targeting
kernel proxies create --type residential --country US --asn AS15169

# With OS targeting
kernel proxies create --type residential --country US --os windows
```

**available os values**: `windows`, `macos`, `android`

### mobile proxy

useful for bot detection avoidance since they use real mobile network ips

```bash
# Basic mobile proxy
kernel proxies create --type mobile --country US --name "US Mobile"

# With carrier targeting
kernel proxies create --type mobile --country US --carrier "T-Mobile"

# With city targeting (requires country)
kernel proxies create --type mobile --country US --city sanfrancisco
```

### custom proxy

use your own proxy servers.

```bash
# Basic custom proxy (host and port required)
kernel proxies create \
  --type custom \
  --host proxy.example.com \
  --port 8080

# With authentication
kernel proxies create \
  --type custom \
  --host proxy.example.com \
  --port 8080 \
  --username user \
  --password pass \
  --name "My Proxy"

# With HTTP protocol (default is HTTPS)
kernel proxies create \
  --type custom \
  --host proxy.example.com \
  --port 3128 \
  --protocol http
```

## manage proxies

### list proxies

```bash
kernel proxies list
```

### get proxy details

```bash
kernel proxies get proxy_abc123xyz -o json
```

### rename a proxy

only the name is mutable. recreate the proxy to change its type, location, protocol, or credentials.

```bash
kernel proxies update proxy_abc123xyz --name "Renamed Proxy" -o json
```

### check proxy health

a check verifies reachability and updates the stored proxy status. omit `--url` for the default health target, or provide a public http(s) url.

```bash
kernel proxies check proxy_abc123xyz -o json
kernel proxies check proxy_abc123xyz --url https://example.com -o json
```

### delete proxy

```bash
# Delete with confirmation prompt
kernel proxies delete proxy_abc123xyz
```

> **info**: deleting a proxy immediately reconfigures associated browsers to route directly to the internet.

## important notes

- **country requirement**: `--city` requires `--country` to be specified
- **country format**: use iso 3166 or `EU`
- **custom proxies**: both `--host` and `--port` are required
- **protocol**: defaults to `https` if not specified
- **targeting specificity**: more specific targeting = fewer available ips (may result in slower connections)
