---
name: kernel-proxies
description: Create and manage datacenter, ISP, residential, mobile, and custom proxies for browsers
---

# Proxies

Route browser traffic through proxies for geo-location, privacy, or testing.

## When to Use

Kernel proxies enable you to route browser traffic through different types of proxy servers, providing enhanced privacy, flexibility, and bot detection avoidance. Proxies can be created once and reused across multiple browser sessions.

## Prerequisites

Load the `kernel-cli` skill for Kernel CLI installation and authentication.

## Proxy Types

1. **Datacenter** - Traffic routed through commercial data centers (fastest speed)
2. **ISP** - Traffic routed through data centers, using residential IP addresses leased from ISPs (balance between speed and detection)
3. **Residential** - Traffic routed through real residential IP addresses (least detectable)
4. **Mobile** - Traffic routed through mobile carrier networks
5. **Custom** - Your own proxy servers

## Create Proxies

### Datacenter Proxy

```bash
# Create datacenter proxy
kernel proxies create --type datacenter --country US --name "US DC"

# With protocol specification
kernel proxies create --type datacenter --country US --protocol https
```

### ISP Proxy

Balance of speed and legitimacy using ISP-assigned IPs.

```bash
# Create ISP proxy
kernel proxies create --type isp --country US --name "US ISP"
```

### Residential Proxy

Real residential IP addresses with advanced targeting options.

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

**Available OS values**: `windows`, `macos`, `android`

### Mobile Proxy

Useful for bot detection avoidance since they use real mobile network IPs

```bash
# Basic mobile proxy
kernel proxies create --type mobile --country US --name "US Mobile"

# With carrier targeting
kernel proxies create --type mobile --country US --carrier "T-Mobile"

# With city targeting (requires country)
kernel proxies create --type mobile --country US --city sanfrancisco
```

### Custom Proxy

Use your own proxy servers.

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

## Manage Proxies

### List Proxies

```bash
kernel proxies list
```

### Get Proxy Details

```bash
kernel proxies get proxy_abc123xyz
```

### Delete Proxy

```bash
# Delete with confirmation prompt
kernel proxies delete proxy_abc123xyz
```

> **Info**: Deleting a proxy immediately reconfigures associated browsers to route directly to the internet.

## Important Notes

- **Country requirement**: `--city` requires `--country` to be specified
- **Country format**: Use ISO 3166 or `EU`
- **Custom proxies**: Both `--host` and `--port` are required
- **Protocol**: Defaults to `https` if not specified
- **Targeting specificity**: More specific targeting = fewer available IPs (may result in slower connections)
