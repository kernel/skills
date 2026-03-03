/**
 * Bot Detection Vendor Analysis Script for Kernel Browser
 *
 * This script connects to a Kernel browser session and navigates to a site
 * to detect and identify bot detection vendors and their specific products.
 *
 * Usage:
 *   KERNEL_BROWSER_ID=<session_id> npm run analyze
 *   KERNEL_BROWSER_ID=<session_id> TARGET_URL=https://example.com npm run analyze
 *
 * The script:
 * 1. Connects to an existing browser session via CDP
 * 2. Monitors network requests, responses, and cookies
 * 3. Identifies bot detection vendors and specific products
 * 4. Generates a detailed vendor detection report
 */

import fs from 'fs';
import path from 'path';
import type { Browser, ConsoleMessage, Page, Request, Response } from 'playwright-core';
import { chromium } from 'playwright-core';
import { Kernel } from '@onkernel/sdk';

// Configuration
interface Config {
  browserId: string | undefined;
  targetUrl: string;
  timeout: number;
  outputDir: string;
}

/**
 * Normalize URL to ensure it has a protocol
 */
function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Extract hostname from URL for folder naming
 */
function getHostnameForFolder(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix and replace dots with dashes for folder name
    return hostname.replace(/^www\./, '').replace(/\./g, '-');
  } catch {
    return 'unknown-host';
  }
}

const targetUrl = normalizeUrl(process.env.TARGET_URL || 'https://www.hyatt.com');
const baseOutputDir = process.env.OUTPUT_DIR || './output';
const hostFolder = getHostnameForFolder(targetUrl);
const browserMode = process.env.BROWSER_MODE || ''; // e.g., 'stealth' or 'normal'

// Output structure: output/<hostname>/<mode>/ (mode is optional)
const outputDir = browserMode 
  ? path.join(baseOutputDir, hostFolder, browserMode)
  : path.join(baseOutputDir, hostFolder);

const CONFIG: Config = {
  browserId: process.env.KERNEL_BROWSER_ID,
  targetUrl: targetUrl,
  timeout: parseInt(process.env.TIMEOUT || '60000'),
  outputDir: outputDir,
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * Vendor and Product Detection Types
 */
interface VendorProduct {
  vendor: string;
  product: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

interface VendorDetection {
  vendor: string;
  products: VendorProduct[];
  urls: string[];
  cookies: string[];
  headers: string[];
  challengeType?: string;
  isBlocked?: boolean;
  blockReason?: string;
}

interface NetworkRequestEntry {
  timestamp: string;
  method: string;
  url: string;
  resourceType: string;
  headers: Record<string, string>;
  vendorMatch: VendorProduct | null;
}

interface NetworkResponseEntry {
  timestamp: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  vendorMatch: VendorProduct | null;
}

interface CookieEntry {
  name: string;
  value: string;
  domain: string;
  vendorMatch: VendorProduct | null;
}

interface ConsoleEntry {
  timestamp: string;
  type: string;
  text: string;
  location: ReturnType<ConsoleMessage['location']>;
}

interface ErrorEntry {
  timestamp: string;
  message: string;
  stack: string | undefined;
}

interface KernelSessionInfo {
  sessionId: string;
  cdpWsUrl: string;
  liveViewUrl: string | undefined;
  stealth: boolean;
  headless: boolean;
  createdAt: string;
}

interface PageBlockStatus {
  page: string;
  isBlocked: boolean;
  blockType: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  vendor?: string;
}

interface CollectedData {
  startTime: string | null;
  endTime: string | null;
  kernelSession: KernelSessionInfo | null;
  networkRequests: NetworkRequestEntry[];
  networkResponses: NetworkResponseEntry[];
  cookies: CookieEntry[];
  vendorDetections: Map<string, VendorDetection>;
  blockDetections: PageBlockStatus[];
  consoleMessages: ConsoleEntry[];
  vendorScriptsDetected: string[]; // URLs of detected vendor scripts (not saved to disk)
  errors: ErrorEntry[];
  screenshots: string[];
  metadata: Record<string, unknown>;
}

const collectedData: CollectedData = {
  startTime: null,
  endTime: null,
  kernelSession: null,
  networkRequests: [],
  networkResponses: [],
  cookies: [],
  vendorDetections: new Map(),
  blockDetections: [],
  consoleMessages: [],
  vendorScriptsDetected: [],
  errors: [],
  screenshots: [],
  metadata: {},
};

/**
 * Log with timestamp and colors
 */
function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  const timestamp = new Date().toISOString();
  const colors = {
    INFO: '\x1b[36m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
  };
  const reset = '\x1b[0m';
  console.log(`${colors[level]}[${timestamp}] [${level}]${reset} ${message}`);
}

/**
 * Vendor Detection Signatures
 * Based on: https://gist.github.com/rgarcia/850c125c40424e007935e6483ac71e37
 * and kernel bot-detection-strategy.plan.md
 */
interface VendorSignature {
  vendor: string;
  urlPatterns: RegExp[];
  cookiePatterns: RegExp[];
  headerPatterns: { name: RegExp; value?: RegExp }[];
  products: ProductSignature[];
}

interface ProductSignature {
  name: string;
  urlPatterns?: RegExp[];
  cookiePatterns?: RegExp[];
  headerPatterns?: { name: RegExp; value?: RegExp }[];
  responsePatterns?: RegExp[];
  statusCodes?: number[];
  detectFromResponse?: (url: string, status: number, headers: Record<string, string>, body?: string) => boolean;
}

const VENDOR_SIGNATURES: VendorSignature[] = [
  // Akamai - Multiple Products
  // Reference: https://docs.hypersolutions.co/akamai-web/getting-started
  {
    vendor: 'Akamai',
    urlPatterns: [
      /akamai/i,
      /akam\//i,
      /akamaibotmanager/i,
      // mPulse RUM (Real User Monitoring)
      /go-mpulse\.net/i,
      /mpulse\.soasta\.com/i,
      // URLs with ak.ai parameter (Akamai telemetry)
      /[?&]ak\.ai=/i,
      // Dynamic Akamai sensor script paths (cannot be hardcoded, pattern-based)
      // Example: /yMOlMy/yS/3T/NVx6/a7xTRI1O5hJJ8/EDi7z45Ou1bfXb/dzldXmhnIQk/CjdBHQkD/Hn0
      /\/[a-zA-Z0-9]{6,}\/[a-zA-Z0-9]{2,}\/[a-zA-Z0-9]{2,}\/[a-zA-Z0-9]{4,}\/[a-zA-Z0-9]+/i,
    ],
    cookiePatterns: [/_abck/i, /bm_sz/i, /bm_sv/i, /ak_bmsc/i, /^akamai_/i],
    headerPatterns: [{ name: /^akamai-/i }],
    products: [
      {
        name: 'Bot Manager',
        // _abck cookie is the core validation cookie
        // Cookie containing ~0~ indicates valid session (can stop posting sensors)
        cookiePatterns: [/_abck/i],
        detectFromResponse: (_url, _status, _headers, body) => {
          return body?.includes('_abck') === true;
        },
      },
      {
        name: 'Bot Manager Premier',
        // bm_sz and bm_sv are secondary tracking cookies
        cookiePatterns: [/bm_sz/i, /bm_sv/i],
      },
      {
        name: 'mPulse RUM',
        // Real User Monitoring - collects performance and behavioral telemetry
        urlPatterns: [/go-mpulse\.net/i, /mpulse\.soasta\.com/i, /[?&]ak\.ai=/i],
      },
      {
        name: 'Sensor Script',
        // Dynamic sensor script endpoint - path is unique per session
        urlPatterns: [/sensor\.js/i, /akam\/\d+\/pixel/i],
      },
      {
        name: 'Edge DNS',
        urlPatterns: [/edgekey\.net/i, /edgesuite\.net/i],
      },
      {
        name: 'Image Manager',
        urlPatterns: [/akstat\.io/i],
      },
    ],
  },

  // Cloudflare
  {
    vendor: 'Cloudflare',
    urlPatterns: [
      /cloudflare/i,
      /\/cdn-cgi\//i,
      /challenges\.cloudflare\.com/i,
    ],
    cookiePatterns: [/__cf_bm/i, /cf_clearance/i, /__cflb/i, /__cfruid/i],
    headerPatterns: [
      { name: /^cf-ray$/i },
      { name: /^cf-cache-status$/i },
      { name: /^cf-request-id$/i },
    ],
    products: [
      {
        name: 'Bot Management',
        cookiePatterns: [/__cf_bm/i],
        urlPatterns: [/\/cdn-cgi\/bm\/cv\//i],
      },
      {
        name: 'Turnstile',
        urlPatterns: [/challenges\.cloudflare\.com\/turnstile/i, /turnstile/i],
      },
      {
        name: 'Challenge Platform',
        urlPatterns: [/\/cdn-cgi\/challenge-platform\//i, /cf-chl-/i],
        statusCodes: [403, 503],
      },
      {
        name: 'JS Challenge',
        urlPatterns: [/\/cdn-cgi\/challenge-platform\/h\/[bg]\//i],
        statusCodes: [503],
      },
      {
        name: 'Managed Challenge',
        urlPatterns: [/\/cdn-cgi\/challenge-platform\/h\/g\//i],
      },
      {
        name: 'AI Labyrinth',
        // Cloudflare's honeypot that traps bots in fake content
        urlPatterns: [/\/cdn-cgi\/l\/chk_jschl/i],
      },
    ],
  },

  // DataDome
  {
    vendor: 'DataDome',
    urlPatterns: [
      /datadome/i,
      /ct\.captcha-delivery\.com/i,
      /geo\.captcha-delivery\.com/i,
      /dd\.prod\.captcha-delivery\.com/i,
      /js\.datadome\.co/i,
    ],
    cookiePatterns: [/^datadome$/i],
    headerPatterns: [{ name: /^x-datadome/i }],
    products: [
      {
        name: 'Interstitial Challenge',
        urlPatterns: [
          /ct\.captcha-delivery\.com\/i\.js/i,
          /geo\.captcha-delivery\.com\/interstitial\//i,
        ],
        statusCodes: [403],
        // When dd.rt === 'i', it's interstitial
      },
      {
        name: 'Slider Challenge',
        urlPatterns: [
          /ct\.captcha-delivery\.com\/c\.js/i,
          /geo\.captcha-delivery\.com\/captcha\//i,
          /dd\.prod\.captcha-delivery\.com\/image\//i,
        ],
        statusCodes: [403],
        // When dd.rt === 'c', it's slider
      },
      {
        name: 'Device Check',
        urlPatterns: [/js\.datadome\.co\/tags\.js/i, /datadome\.js/i],
      },
      {
        name: 'Picasso Fingerprint',
        // DataDome's canvas rendering fingerprint validation
        urlPatterns: [/geo\.captcha-delivery\.com.*picasso/i],
      },
    ],
  },

  // HUMAN (formerly PerimeterX)
  {
    vendor: 'HUMAN',
    urlPatterns: [/perimeterx/i, /px-cdn\.net/i, /px-cloud\.net/i, /pxchk\.net/i],
    cookiePatterns: [/^_px/i, /_pxhd/i, /_pxvid/i, /_pxde/i],
    headerPatterns: [{ name: /^x-px-/i }],
    products: [
      {
        name: 'Bot Defender',
        urlPatterns: [/\/px\.js/i, /pxchk\.net/i],
        cookiePatterns: [/^_px3$/i, /^_px2$/i],
      },
      {
        name: 'Sensor SDK',
        urlPatterns: [/px-cdn\.net.*\/main\.min\.js/i],
      },
      {
        name: 'Press & Hold Challenge',
        // HUMAN's unique "Press & Hold" CAPTCHA alternative
        urlPatterns: [/px-cloud\.net.*challenge/i],
      },
      {
        name: 'Code Defender',
        urlPatterns: [/px-cdn\.net.*\/cd\//i],
      },
    ],
  },

  // Imperva/Incapsula
  {
    vendor: 'Imperva',
    urlPatterns: [/imperva/i, /incapsula/i, /_Incapsula_Resource/i],
    cookiePatterns: [/^incap_ses_/i, /^visid_incap_/i, /^nlbi_/i, /^reese84$/i],
    headerPatterns: [{ name: /^x-cdn$/i, value: /imperva/i }, { name: /^x-iinfo$/i }],
    products: [
      {
        name: 'Advanced Bot Protection (utmvc)',
        urlPatterns: [/_Incapsula_Resource\?SWJIYLWA/i],
        cookiePatterns: [/^visid_incap_/i],
      },
      {
        name: 'Advanced Bot Protection (reese84)',
        cookiePatterns: [/^reese84$/i],
        headerPatterns: [{ name: /^x-d-token$/i }],
      },
      {
        name: 'WAF',
        cookiePatterns: [/^incap_ses_/i],
      },
      {
        name: 'DDoS Protection',
        cookiePatterns: [/^nlbi_/i],
      },
    ],
  },

  // Kasada
  {
    vendor: 'Kasada',
    urlPatterns: [
      /kasada/i,
      /cdndex\.io/i,
      // Kasada uses UUID-based paths
      /\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/ips\.js/i,
      /\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/tl/i,
      /\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/fp/i,
    ],
    cookiePatterns: [],
    headerPatterns: [{ name: /^x-kpsdk-ct$/i }, { name: /^x-kpsdk-cd$/i }, { name: /^x-kpsdk-v$/i }],
    products: [
      {
        name: 'IPS (Initial Page Security)',
        // Flow 1: 429 on homepage with ips.js
        urlPatterns: [/\/ips\.js/i],
        statusCodes: [429],
      },
      {
        name: 'FP (Fingerprint Endpoint)',
        // Flow 2: Background /fp requests
        urlPatterns: [/\/fp\/?(\?|$)/i, /\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/fp/i],
      },
      {
        name: 'Telemetry',
        urlPatterns: [/\/tl\/?(\?|$)/i, /\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/tl/i, /cdndex\.io/i],
      },
      {
        name: 'POW Challenge',
        // Proof-of-work challenges
        headerPatterns: [{ name: /^x-kpsdk-cd$/i }],
      },
    ],
  },

  // reCAPTCHA
  {
    vendor: 'Google',
    urlPatterns: [
      /recaptcha/i,
      /www\.google\.com\/recaptcha/i,
      /www\.recaptcha\.net/i,
      /www\.gstatic\.com\/recaptcha/i,
    ],
    cookiePatterns: [],
    headerPatterns: [],
    products: [
      {
        name: 'reCAPTCHA v2',
        urlPatterns: [/recaptcha\/api2\/anchor/i, /recaptcha\/api2\/bframe/i],
      },
      {
        name: 'reCAPTCHA v3',
        urlPatterns: [/recaptcha\/api\.js\?.*render=/i],
      },
      {
        name: 'reCAPTCHA Enterprise',
        urlPatterns: [/recaptcha\/enterprise/i, /recaptcha\/enterprise\.js/i],
      },
    ],
  },

  // hCaptcha
  {
    vendor: 'hCaptcha',
    urlPatterns: [/hcaptcha\.com/i, /hcaptcha/i],
    cookiePatterns: [],
    headerPatterns: [],
    products: [
      {
        name: 'hCaptcha Widget',
        urlPatterns: [/hcaptcha\.com\/1\/api\.js/i],
      },
      {
        name: 'hCaptcha Enterprise',
        urlPatterns: [/hcaptcha\.com.*enterprise/i],
      },
    ],
  },

  // FingerprintJS
  {
    vendor: 'FingerprintJS',
    urlPatterns: [/fpjs\.io/i, /fingerprintjs/i, /fpcdn\.io/i, /fpjs\.pro/i],
    cookiePatterns: [/^_iidt$/i, /^_vid_t$/i],
    headerPatterns: [],
    products: [
      {
        name: 'Fingerprint Pro',
        urlPatterns: [/fpjs\.pro/i, /api\.fpjs\.io/i],
      },
      {
        name: 'Fingerprint OSS',
        urlPatterns: [/fingerprintjs/i],
      },
      {
        name: 'BotD',
        urlPatterns: [/botd/i],
      },
    ],
  },

  // Shape Security (F5)
  {
    vendor: 'Shape Security',
    urlPatterns: [
      /shapesecurity\.com/i,
      /shapeapp\.com/i,
      /f5\.com\/shape/i,
      /\/shapes\/telemetry/i,
      /\/api\/shapes\//i,
    ],
    cookiePatterns: [],
    headerPatterns: [{ name: /^x-shape/i }, { name: /^x-f5/i }],
    products: [
      {
        name: 'Enterprise Defense',
        urlPatterns: [/shapesecurity\.com/i, /shapeapp\.com/i, /f5\.com\/shape/i],
      },
    ],
  },

  // Arkose Labs (FunCaptcha)
  {
    vendor: 'Arkose Labs',
    urlPatterns: [
      /arkoselabs/i,
      /funcaptcha/i,
      /client-api\.arkoselabs\.com/i,
      /arkoselabs\.com\/fc\//i,
    ],
    cookiePatterns: [],
    headerPatterns: [],
    products: [
      {
        name: 'FunCaptcha',
        urlPatterns: [/funcaptcha/i, /arkoselabs\.com\/fc\//i],
      },
      {
        name: 'Arkose Detect',
        urlPatterns: [/arkoselabs.*detect/i],
      },
    ],
  },
];

/**
 * Detect vendor and product from URL
 */
function detectVendorFromUrl(url: string): VendorProduct | null {
  for (const vendor of VENDOR_SIGNATURES) {
    // Check vendor-level URL patterns
    const vendorMatch = vendor.urlPatterns.some((pattern) => pattern.test(url));
    if (!vendorMatch) continue;

    // Check for specific product match
    for (const product of vendor.products) {
      if (product.urlPatterns?.some((pattern) => pattern.test(url))) {
        return {
          vendor: vendor.vendor,
          product: product.name,
          confidence: 'high',
          evidence: [`URL matches pattern for ${product.name}`],
        };
      }
    }

    // Generic vendor match without specific product
    return {
      vendor: vendor.vendor,
      product: 'Unknown Product',
      confidence: 'medium',
      evidence: [`URL matches vendor pattern: ${url}`],
    };
  }
  return null;
}

/**
 * Detect vendor and product from cookie
 */
function detectVendorFromCookie(name: string, _value: string): VendorProduct | null {
  for (const vendor of VENDOR_SIGNATURES) {
    // Check vendor-level cookie patterns
    const vendorMatch = vendor.cookiePatterns.some((pattern) => pattern.test(name));
    if (!vendorMatch) continue;

    // Check for specific product match
    for (const product of vendor.products) {
      if (product.cookiePatterns?.some((pattern) => pattern.test(name))) {
        return {
          vendor: vendor.vendor,
          product: product.name,
          confidence: 'high',
          evidence: [`Cookie "${name}" matches pattern for ${product.name}`],
        };
      }
    }

    // Generic vendor match without specific product
    return {
      vendor: vendor.vendor,
      product: 'Unknown Product',
      confidence: 'medium',
      evidence: [`Cookie "${name}" matches vendor pattern`],
    };
  }
  return null;
}

/**
 * Detect vendor and product from headers
 */
function detectVendorFromHeaders(headers: Record<string, string>): VendorProduct | null {
  for (const vendor of VENDOR_SIGNATURES) {
    for (const headerPattern of vendor.headerPatterns) {
      for (const [headerName, headerValue] of Object.entries(headers)) {
        if (headerPattern.name.test(headerName)) {
          if (!headerPattern.value || headerPattern.value.test(headerValue)) {
            // Check for specific product match
            for (const product of vendor.products) {
              if (product.headerPatterns?.some((p) => p.name.test(headerName))) {
                return {
                  vendor: vendor.vendor,
                  product: product.name,
                  confidence: 'high',
                  evidence: [`Header "${headerName}" matches pattern for ${product.name}`],
                };
              }
            }

            return {
              vendor: vendor.vendor,
              product: 'Unknown Product',
              confidence: 'medium',
              evidence: [`Header "${headerName}" matches vendor pattern`],
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Detect challenge type from response
 */
function detectChallengeType(
  url: string,
  status: number,
  headers: Record<string, string>,
): { vendor: string; product: string; isBlocked: boolean; blockReason?: string } | null {
  // DataDome specific detection
  if (/captcha-delivery\.com/i.test(url) || /datadome/i.test(Object.keys(headers).join(' '))) {
    if (/\/i\.js/i.test(url) || /interstitial/i.test(url)) {
      return { vendor: 'DataDome', product: 'Interstitial Challenge', isBlocked: false };
    }
    if (/\/c\.js/i.test(url) || /captcha/i.test(url)) {
      return { vendor: 'DataDome', product: 'Slider Challenge', isBlocked: false };
    }
  }

  // Kasada flow detection
  if (/ips\.js/i.test(url) && status === 429) {
    return { vendor: 'Kasada', product: 'IPS (Initial Page Security)', isBlocked: false };
  }
  if (/\/fp\/?(\?|$)/i.test(url) && status === 429) {
    return { vendor: 'Kasada', product: 'FP (Fingerprint Endpoint)', isBlocked: false };
  }

  // Cloudflare challenge detection
  if (/cdn-cgi\/challenge-platform/i.test(url)) {
    if (status === 503) {
      return { vendor: 'Cloudflare', product: 'JS Challenge', isBlocked: false };
    }
    if (status === 403) {
      return { vendor: 'Cloudflare', product: 'Managed Challenge', isBlocked: false };
    }
  }

  // Akamai detection
  if (headers['_abck'] || /akam\//i.test(url)) {
    return { vendor: 'Akamai', product: 'Bot Manager', isBlocked: false };
  }

  // Akamai mPulse detection
  if (/go-mpulse\.net/i.test(url) || /[?&]ak\.ai=/i.test(url)) {
    return { vendor: 'Akamai', product: 'mPulse RUM', isBlocked: false };
  }

  return null;
}

/**
 * Update vendor detection state
 */
function updateVendorDetection(detection: VendorProduct, context: 'url' | 'cookie' | 'header', evidence: string): void {
  const key = detection.vendor;
  let vendorData = collectedData.vendorDetections.get(key);

  if (!vendorData) {
    vendorData = {
      vendor: detection.vendor,
      products: [],
      urls: [],
      cookies: [],
      headers: [],
    };
    collectedData.vendorDetections.set(key, vendorData);
  }

  // Add product if not already present
  const existingProduct = vendorData.products.find((p) => p.product === detection.product);
  if (existingProduct) {
    existingProduct.evidence.push(evidence);
    if (detection.confidence === 'high' && existingProduct.confidence !== 'high') {
      existingProduct.confidence = 'high';
    }
  } else {
    vendorData.products.push(detection);
  }

  // Add evidence to appropriate category
  if (context === 'url' && !vendorData.urls.includes(evidence)) {
    vendorData.urls.push(evidence);
  } else if (context === 'cookie' && !vendorData.cookies.includes(evidence)) {
    vendorData.cookies.push(evidence);
  } else if (context === 'header' && !vendorData.headers.includes(evidence)) {
    vendorData.headers.push(evidence);
  }
}

/**
 * Common login page URL patterns
 */
const LOGIN_URL_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/sign-in/i,
  /\/auth/i,
  /\/authenticate/i,
  /\/account\/login/i,
  /\/user\/login/i,
  /\/secure\/login/i,
  /\/web\/login/i,
  /\/oauth/i,
  /\/sso/i,
];

/**
 * Common login link text patterns
 */
const LOGIN_LINK_TEXT_PATTERNS = [
  /^log\s*in$/i,
  /^sign\s*in$/i,
  /^login$/i,
  /^signin$/i,
  /^my\s*account$/i,
  /^account$/i,
  /^member\s*login$/i,
];

/**
 * Find login page URL by checking links on the page or constructing common paths
 */
async function findLoginPage(page: Page, baseUrl: string): Promise<string | null> {
  const baseUrlObj = new URL(baseUrl);
  
  // First, try to find a login link on the page
  try {
    const loginLink = await page.evaluate((args: { urlPatterns: string[]; textPatterns: string[] }) => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        
        // Check if href matches login patterns
        for (const pattern of args.urlPatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(href)) {
            return href;
          }
        }
        
        // Check if link text suggests login
        for (const pattern of args.textPatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(text)) {
            return href;
          }
        }
      }
      
      return null;
    }, { urlPatterns: LOGIN_URL_PATTERNS.map(p => p.source), textPatterns: LOGIN_LINK_TEXT_PATTERNS.map(p => p.source) });
    
    if (loginLink) {
      // Convert relative URL to absolute
      if (loginLink.startsWith('/')) {
        return `${baseUrlObj.origin}${loginLink}`;
      } else if (loginLink.startsWith('http')) {
        return loginLink;
      } else {
        return `${baseUrlObj.origin}/${loginLink}`;
      }
    }
  } catch {
    // Page evaluation failed, continue with fallback
  }
  
  // Fallback: try common login paths
  const commonLoginPaths = [
    '/login',
    '/signin',
    '/sign-in',
    '/auth/login',
    '/account/login',
    '/user/login',
    '/secure/login',
  ];
  
  for (const loginPath of commonLoginPaths) {
    const testUrl = `${baseUrlObj.origin}${loginPath}`;
    try {
      const response = await page.context().request.head(testUrl, { 
        timeout: 5000,
        failOnStatusCode: false,
      });
      // Accept 200, 302, 303 (redirects to actual login page)
      if (response.status() === 200 || response.status() === 302 || response.status() === 303) {
        return testUrl;
      }
    } catch {
      // Path doesn't exist or request failed, try next
    }
  }
  
  return null;
}

/**
 * Collect cookies from the page and detect vendors
 */
async function collectAndAnalyzeCookies(page: Page): Promise<void> {
  const cookies = await page.context().cookies();

  for (const cookie of cookies) {
    const vendorMatch = detectVendorFromCookie(cookie.name, cookie.value);
    const entry: CookieEntry = {
      name: cookie.name,
      value: cookie.value.substring(0, 100) + (cookie.value.length > 100 ? '...' : ''),
      domain: cookie.domain,
      vendorMatch,
    };
    collectedData.cookies.push(entry);

    if (vendorMatch) {
      updateVendorDetection(vendorMatch, 'cookie', cookie.name);
      log(`[VENDOR COOKIE] ${vendorMatch.vendor} - ${vendorMatch.product}: ${cookie.name}`, 'WARN');
    }
  }
}

/**
 * Check for DataDome hard IP block
 */
async function checkDataDomeBlock(page: Page): Promise<{ isBlocked: boolean; blockType?: string }> {
  try {
    const ddObject = await page.evaluate(() => {
      // @ts-expect-error - dd is a global object set by DataDome
      if (typeof dd !== 'undefined') {
        // @ts-expect-error - dd is a global object set by DataDome
        return { rt: dd.rt, t: dd.t, cid: dd.cid };
      }
      return null;
    });

    if (ddObject) {
      // dd.t === 'bv' means IP is HARD BLOCKED - solving captcha will NOT help
      if (ddObject.t === 'bv') {
        return { isBlocked: true, blockType: 'IP Hard Block (must change IP)' };
      }
      // dd.rt === 'c' is slider, dd.rt === 'i' is interstitial
      if (ddObject.rt === 'c') {
        return { isBlocked: false, blockType: 'Slider Challenge' };
      }
      if (ddObject.rt === 'i') {
        return { isBlocked: false, blockType: 'Interstitial Challenge' };
      }
    }
  } catch {
    // dd object not present
  }
  return { isBlocked: false };
}

/**
 * Check for Akamai cookie validity
 */
async function checkAkamaiCookieValidity(page: Page): Promise<{ isValid: boolean; details?: string }> {
  const cookies = await page.context().cookies();
  const abckCookie = cookies.find((c) => c.name === '_abck');

  if (abckCookie) {
    // Cookie containing ~0~ indicates a valid session
    if (abckCookie.value.includes('~0~')) {
      return { isValid: true, details: 'Contains ~0~ (valid session)' };
    }
    return { isValid: false, details: 'Does not contain ~0~ (may need more sensor POSTs)' };
  }
  return { isValid: false, details: 'No _abck cookie found' };
}

/**
 * Block page detection result
 */
interface BlockDetectionResult {
  isBlocked: boolean;
  blockType: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  vendor?: string;
}

/**
 * Patterns that indicate a block page
 */
const BLOCK_PAGE_PATTERNS = {
  // Common block/error messages
  textPatterns: [
    { pattern: /access\s*(to\s*this\s*)?(page|site|website)?\s*(has\s*been\s*)?(denied|blocked|restricted)/i, type: 'Access Denied' },
    { pattern: /you\s*(have\s*been|are)\s*blocked/i, type: 'Blocked' },
    { pattern: /your\s*(ip|request)\s*(has\s*been\s*)?(blocked|denied)/i, type: 'IP Blocked' },
    { pattern: /something\s*went\s*wrong/i, type: 'Error Page' },
    { pattern: /please\s*try\s*(again\s*)?(later|after)/i, type: 'Rate Limited' },
    { pattern: /too\s*many\s*requests/i, type: 'Rate Limited' },
    { pattern: /we\s*appreciate\s*your\s*patience/i, type: 'Block Page' },
    { pattern: /try\s*accessing\s*the\s*site\s*again\s*after/i, type: 'Temporary Block' },
    { pattern: /automated\s*(access|requests?)\s*(is\s*)?not\s*allowed/i, type: 'Bot Blocked' },
    { pattern: /unusual\s*(traffic|activity)\s*(detected|from)/i, type: 'Bot Detection' },
    { pattern: /verify\s*(you\s*are|that\s*you('re)?\s*)(a\s*)?(human|not\s*a\s*(bot|robot))/i, type: 'Human Verification' },
    { pattern: /please\s*complete\s*(the\s*)?(security\s*)?check/i, type: 'Security Check' },
    { pattern: /why\s*(have\s*I\s*been|am\s*I)\s*blocked/i, type: 'Block Page' },
    { pattern: /ray\s*id:/i, type: 'Cloudflare Block' },
    { pattern: /error\s*code:\s*\d+/i, type: 'Error Page' },
    { pattern: /reference\s*#?\s*[\da-f]+/i, type: 'Block Reference' },
  ],
  // Error ID patterns (like the one in Dick's screenshot)
  errorIdPatterns: [
    /error[:\s]+[\da-f]{6,}\.\d+\.[a-f\d]+/i,  // Error: 0.486adc17.1769790831.fb53795
    /IP[:\s]+\d+\.\d+\.\d+\.\d+/i,  // IP: 100.26.206.180
  ],
  // Title patterns
  titlePatterns: [
    /access\s*denied/i,
    /blocked/i,
    /error/i,
    /forbidden/i,
    /not\s*allowed/i,
    /please\s*wait/i,
    /security\s*check/i,
  ],
};

/**
 * Check if the page is a block/error page
 */
async function detectBlockPage(page: Page): Promise<BlockDetectionResult> {
  const evidence: string[] = [];
  let blockType = '';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let vendor: string | undefined;

  try {
    // Get page content and title
    const pageData = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const title = document.title || '';
      const html = document.documentElement?.innerHTML || '';
      
      // Check for minimal content (block pages often have very little content)
      const contentLength = body.length;
      const hasMinimalContent = contentLength < 2000;
      
      // Check for common block page elements
      const hasForm = document.querySelector('form') !== null;
      const hasNavigation = document.querySelector('nav') !== null;
      const hasMultipleLinks = document.querySelectorAll('a').length > 10;
      
      return {
        body,
        title,
        html,
        contentLength,
        hasMinimalContent,
        hasForm,
        hasNavigation,
        hasMultipleLinks,
        url: window.location.href,
      };
    });

    // Check text patterns
    for (const { pattern, type } of BLOCK_PAGE_PATTERNS.textPatterns) {
      if (pattern.test(pageData.body)) {
        evidence.push(`Page contains: "${pageData.body.match(pattern)?.[0]}"`);
        if (!blockType) blockType = type;
        confidence = 'high';
      }
    }

    // Check error ID patterns
    for (const pattern of BLOCK_PAGE_PATTERNS.errorIdPatterns) {
      const match = pageData.body.match(pattern);
      if (match) {
        evidence.push(`Error ID found: "${match[0]}"`);
        if (!blockType) blockType = 'Block Page with Error ID';
        confidence = 'high';
      }
    }

    // Check title patterns
    for (const pattern of BLOCK_PAGE_PATTERNS.titlePatterns) {
      if (pattern.test(pageData.title)) {
        evidence.push(`Page title indicates block: "${pageData.title}"`);
        if (!blockType) blockType = 'Block Page';
        if (confidence !== 'high') confidence = 'medium';
      }
    }

    // Minimal content with no navigation suggests a block page
    if (pageData.hasMinimalContent && !pageData.hasNavigation && !pageData.hasMultipleLinks) {
      evidence.push(`Minimal page content (${pageData.contentLength} chars, no navigation)`);
      if (!blockType) blockType = 'Possible Block Page';
      if (confidence === 'low') confidence = 'medium';
    }

    // Vendor attribution for already-detected blocks only.
    // These patterns match block-page-specific markup, not general CDN usage,
    // and only run when a block signal has already been found — so a site that
    // merely loads a Cloudflare/Akamai script doesn't get flagged as suspicious.
    if (confidence !== 'low') {
      if (/class="cf-error-details"|cf-error-code|cf-ray/i.test(pageData.html) || /ray\s*id:\s*[\da-f]+/i.test(pageData.body)) {
        vendor = 'Cloudflare';
        evidence.push('Cloudflare block page detected');
      } else if (/access\s*denied.*akamai|akamai.*reference\s*#/i.test(pageData.body)) {
        vendor = 'Akamai';
        evidence.push('Akamai block page detected');
      } else if (/class="(incapsula|imperva)[^"]*"|_Incapsula_Resource/i.test(pageData.html)) {
        vendor = 'Imperva';
        evidence.push('Imperva/Incapsula block page detected');
      } else if (/captcha-delivery\.com|datadome.*blocked/i.test(pageData.html)) {
        vendor = 'DataDome';
        evidence.push('DataDome block page detected');
      } else if (/perimeterx\.com\/blocked|_pxCaptcha/i.test(pageData.html)) {
        vendor = 'HUMAN';
        evidence.push('HUMAN/PerimeterX block page detected');
      }
    }

    const isBlocked = evidence.length > 0 && confidence !== 'low';

    return {
      isBlocked,
      blockType: blockType || 'Unknown',
      confidence,
      evidence,
      vendor,
    };
  } catch (error) {
    return {
      isBlocked: false,
      blockType: 'Detection Error',
      confidence: 'low',
      evidence: [`Error during detection: ${(error as Error).message}`],
    };
  }
}

/**
 * Main test function
 */
async function runTest(): Promise<void> {
  // Validate configuration
  if (!CONFIG.browserId) {
    console.error(`
╔════════════════════════════════════════════════════════════════╗
║  ERROR: KERNEL_BROWSER_ID environment variable is required     ║
╠════════════════════════════════════════════════════════════════╣
║  Usage:                                                        ║
║    KERNEL_BROWSER_ID=<session_id> npm run analyze              ║
║                                                                ║
║  To create a Kernel browser:                                   ║
║    kernel browsers create -s --viewport 1920x1080@25 -t 300    ║
║                                                                ║
║  To list existing browsers:                                    ║
║    kernel browsers list                                        ║
╚════════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  log('='.repeat(60));
  log('Bot Detection Vendor Analysis - Kernel Browser');
  log('='.repeat(60));
  log(`Browser ID: ${CONFIG.browserId}`);
  log(`Target URL: ${CONFIG.targetUrl}`);
  log(`Timeout: ${CONFIG.timeout}ms`);
  log('='.repeat(60));

  collectedData.startTime = new Date().toISOString();
  collectedData.metadata = {
    browserId: CONFIG.browserId,
    targetUrl: CONFIG.targetUrl,
    timeout: CONFIG.timeout,
  };

  let browser: Browser | undefined;

  try {
    // Get browser session info via Kernel SDK
    log(`Fetching browser session: ${CONFIG.browserId}...`);
    const kernel = new Kernel();
    const session = await kernel.browsers.retrieve(CONFIG.browserId);

    const sessionInfo: KernelSessionInfo = {
      sessionId: session.session_id,
      cdpWsUrl: session.cdp_ws_url,
      liveViewUrl: session.browser_live_view_url,
      stealth: session.stealth,
      headless: session.headless,
      createdAt: session.created_at,
    };
    collectedData.kernelSession = sessionInfo;

    log(`Session found`);
    log(`  Stealth Mode: ${session.stealth}`);
    log(`  Headless: ${session.headless}`);
    if (session.browser_live_view_url) {
      log(`  Live View: ${session.browser_live_view_url}`);
    }

    // Connect via CDP
    log('Connecting to browser via CDP...');
    browser = await chromium.connectOverCDP(session.cdp_ws_url);
    log('Connected to Kernel browser');

    // Get the default context and page
    const contexts = browser.contexts();
    let context = contexts[0];
    if (!context) {
      context = await browser.newContext();
    }

    const pages = context.pages();
    let page: Page;
    if (pages.length > 0) {
      page = pages[0];
    } else {
      page = await context.newPage();
    }

    // Monitor network requests for vendor detection
    page.on('request', (request: Request) => {
      const url = request.url();
      const headers = request.headers();
      const vendorFromUrl = detectVendorFromUrl(url);
      const vendorFromHeaders = detectVendorFromHeaders(headers);
      const vendorMatch = vendorFromUrl || vendorFromHeaders;

      const entry: NetworkRequestEntry = {
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: url,
        resourceType: request.resourceType(),
        headers: headers,
        vendorMatch,
      };
      collectedData.networkRequests.push(entry);

      if (vendorMatch) {
        updateVendorDetection(vendorMatch, 'url', url);
        log(`[VENDOR] ${vendorMatch.vendor} - ${vendorMatch.product}: ${url.substring(0, 80)}...`, 'WARN');
      }
    });

    // Monitor network responses for challenge detection
    page.on('response', async (response: Response) => {
      const url = response.url();
      const status = response.status();
      const headers = response.headers();

      const vendorFromUrl = detectVendorFromUrl(url);
      const vendorFromHeaders = detectVendorFromHeaders(headers);
      const challengeInfo = detectChallengeType(url, status, headers);
      const vendorMatch = vendorFromUrl || vendorFromHeaders;

      const entry: NetworkResponseEntry = {
        timestamp: new Date().toISOString(),
        url: url,
        status: status,
        headers: headers,
        vendorMatch,
      };
      collectedData.networkResponses.push(entry);

      if (challengeInfo) {
        log(`[CHALLENGE] ${challengeInfo.vendor} - ${challengeInfo.product} (Status: ${status})`, 'WARN');
        const detection = collectedData.vendorDetections.get(challengeInfo.vendor);
        if (detection) {
          detection.challengeType = challengeInfo.product;
          detection.isBlocked = challengeInfo.isBlocked;
          detection.blockReason = challengeInfo.blockReason;
        }
      }

      // Track detected vendor scripts (not saved to disk)
      if (vendorMatch) {
        if (url.endsWith('.js') || headers['content-type']?.includes('javascript')) {
          if (!collectedData.vendorScriptsDetected.includes(url)) {
            collectedData.vendorScriptsDetected.push(url);
          }
        }
      }
    });

    // Monitor console messages
    page.on('console', (msg: ConsoleMessage) => {
      const entry: ConsoleEntry = {
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      };
      collectedData.consoleMessages.push(entry);

      // Log warnings and errors
      if (msg.type() === 'error' || msg.type() === 'warning') {
        log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`, 'WARN');
      }
    });

    // Monitor page errors
    page.on('pageerror', (error: Error) => {
      const entry: ErrorEntry = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
      };
      collectedData.errors.push(entry);
      log(`[PAGE ERROR] ${error.message}`, 'ERROR');
    });

    // Navigate to target
    log(`Navigating to ${CONFIG.targetUrl}...`);
    try {
      await page.goto(CONFIG.targetUrl, {
        waitUntil: 'networkidle',
        timeout: CONFIG.timeout,
      });
      log('Page loaded successfully');
    } catch (e) {
      log(`Navigation completed with: ${(e as Error).message}`, 'WARN');
    }

    // Wait a bit for any delayed scripts
    log('Waiting for additional scripts to load...');
    await page.waitForTimeout(5000);

    // Take homepage screenshot
    const homepageScreenshotPath = path.join(
      CONFIG.outputDir,
      `screenshot-homepage-${Date.now()}.png`,
    );
    await page.screenshot({ path: homepageScreenshotPath, fullPage: true });
    collectedData.screenshots.push(homepageScreenshotPath);
    log(`Homepage screenshot saved to: ${homepageScreenshotPath}`);

    // Check if homepage is blocked
    log('Checking homepage for block page...');
    const homepageBlockStatus = await detectBlockPage(page);
    if (homepageBlockStatus.isBlocked) {
      log(`[BLOCKED] Homepage is blocked: ${homepageBlockStatus.blockType}`, 'ERROR');
      homepageBlockStatus.evidence.forEach((e) => log(`  - ${e}`, 'ERROR'));
      collectedData.blockDetections.push({
        page: 'homepage',
        ...homepageBlockStatus,
      });
    } else if (homepageBlockStatus.evidence.length > 0) {
      log(`[WARNING] Homepage may be blocked (${homepageBlockStatus.confidence} confidence)`, 'WARN');
      homepageBlockStatus.evidence.forEach((e) => log(`  - ${e}`, 'WARN'));
      collectedData.blockDetections.push({
        page: 'homepage',
        ...homepageBlockStatus,
      });
    }

    // Try to find and navigate to login page
    log('\nLooking for login page...');
    const loginUrl = await findLoginPage(page, CONFIG.targetUrl);
    
    if (loginUrl) {
      log(`Found login page: ${loginUrl}`);
      try {
        await page.goto(loginUrl, {
          waitUntil: 'networkidle',
          timeout: CONFIG.timeout,
        });
        log('Login page loaded successfully');
        
        // Wait for login page scripts
        await page.waitForTimeout(5000);
        
        // Take login page screenshot
        const loginScreenshotPath = path.join(
          CONFIG.outputDir,
          `screenshot-login-${Date.now()}.png`,
        );
        await page.screenshot({ path: loginScreenshotPath, fullPage: true });
        collectedData.screenshots.push(loginScreenshotPath);
        log(`Login page screenshot saved to: ${loginScreenshotPath}`);

        // Check if login page is blocked
        log('Checking login page for block page...');
        const loginBlockStatus = await detectBlockPage(page);
        if (loginBlockStatus.isBlocked) {
          log(`[BLOCKED] Login page is blocked: ${loginBlockStatus.blockType}`, 'ERROR');
          loginBlockStatus.evidence.forEach((e) => log(`  - ${e}`, 'ERROR'));
          collectedData.blockDetections.push({
            page: 'login',
            ...loginBlockStatus,
          });
        } else if (loginBlockStatus.evidence.length > 0) {
          log(`[WARNING] Login page may be blocked (${loginBlockStatus.confidence} confidence)`, 'WARN');
          loginBlockStatus.evidence.forEach((e) => log(`  - ${e}`, 'WARN'));
          collectedData.blockDetections.push({
            page: 'login',
            ...loginBlockStatus,
          });
        }
      } catch (e) {
        log(`Login page navigation completed with: ${(e as Error).message}`, 'WARN');
      }
    } else {
      log('No login page found, continuing with homepage analysis only');
    }

    // Collect and analyze cookies
    log('\nAnalyzing cookies for vendor signatures...');
    await collectAndAnalyzeCookies(page);

    // Check for specific vendor states
    const dataDomeStatus = await checkDataDomeBlock(page);
    if (dataDomeStatus.blockType) {
      log(`[DATADOME] Status: ${dataDomeStatus.blockType}`, dataDomeStatus.isBlocked ? 'ERROR' : 'WARN');
      const ddDetection = collectedData.vendorDetections.get('DataDome');
      if (ddDetection) {
        ddDetection.isBlocked = dataDomeStatus.isBlocked;
        ddDetection.blockReason = dataDomeStatus.blockType;
      }
    }

    const akamaiStatus = await checkAkamaiCookieValidity(page);
    if (collectedData.vendorDetections.has('Akamai')) {
      log(`[AKAMAI] Cookie Status: ${akamaiStatus.details}`, akamaiStatus.isValid ? 'INFO' : 'WARN');
    }

    // Generate vendor detection summary
    log('\n' + '='.repeat(60));
    log('VENDOR DETECTION SUMMARY');
    log('='.repeat(60));

    log(`Total network requests: ${collectedData.networkRequests.length}`);
    log(`Total responses analyzed: ${collectedData.networkResponses.length}`);
    log(`Cookies analyzed: ${collectedData.cookies.length}`);
    log(`Vendor scripts detected: ${collectedData.vendorScriptsDetected.length} (not saved to disk)`);
    log(`Vendors detected: ${collectedData.vendorDetections.size}`);

    if (collectedData.vendorDetections.size > 0) {
      log('\n' + '-'.repeat(60));
      log('DETECTED VENDORS AND PRODUCTS');
      log('-'.repeat(60));

      for (const [vendorName, detection] of collectedData.vendorDetections) {
        log(`\n[${vendorName}]`);

        // List products
        const productsByConfidence = detection.products.sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.confidence] - order[b.confidence];
        });

        for (const product of productsByConfidence) {
          const confidenceIcon = product.confidence === 'high' ? '●' : product.confidence === 'medium' ? '◐' : '○';
          log(`  ${confidenceIcon} ${product.product} (${product.confidence} confidence)`);
          for (const evidence of product.evidence.slice(0, 3)) {
            log(`      - ${evidence.substring(0, 70)}${evidence.length > 70 ? '...' : ''}`);
          }
          if (product.evidence.length > 3) {
            log(`      ... and ${product.evidence.length - 3} more evidence items`);
          }
        }

        // Show challenge/block status
        if (detection.challengeType) {
          log(`  Challenge Type: ${detection.challengeType}`);
        }
        if (detection.isBlocked) {
          log(`  BLOCKED: ${detection.blockReason}`, 'ERROR');
        }

        // Summary stats
        log(`  URLs matched: ${detection.urls.length}`);
        log(`  Cookies matched: ${detection.cookies.length}`);
        log(`  Headers matched: ${detection.headers.length}`);
      }
    } else {
      log('\nNo bot detection vendors detected on this page.');
    }

    // Vendor-specific recommendations
    log('\n' + '-'.repeat(60));
    log('VENDOR-SPECIFIC ANALYSIS');
    log('-'.repeat(60));

    if (collectedData.vendorDetections.has('Kasada')) {
      const kasada = collectedData.vendorDetections.get('Kasada')!;
      log('\n[Kasada Analysis]');
      const hasIPS = kasada.products.some((p) => p.product.includes('IPS'));
      const hasFP = kasada.products.some((p) => p.product.includes('FP'));
      if (hasIPS) {
        log('  - Flow 1 (IPS): Site blocks immediately with 429');
        log('  - Must solve ips.js challenge before accessing content');
      }
      if (hasFP) {
        log('  - Flow 2 (FP): Background fingerprint endpoint');
        log('  - Requires x-kpsdk-ct token for ongoing requests');
      }
    }

    if (collectedData.vendorDetections.has('Akamai')) {
      log('\n[Akamai Analysis]');
      log(`  - Cookie validity: ${akamaiStatus.details}`);
      if (!akamaiStatus.isValid) {
        log('  - May need to POST up to 3 sensor payloads');
        log('  - Header order is a PRIMARY detection signal');
      }
    }

    if (collectedData.vendorDetections.has('DataDome')) {
      log('\n[DataDome Analysis]');
      log(`  - Status: ${dataDomeStatus.blockType || 'Active monitoring'}`);
      if (dataDomeStatus.isBlocked) {
        log('  - IP is HARD BLOCKED - must change IP, solving captcha will NOT help');
      }
    }

    if (collectedData.vendorDetections.has('Cloudflare')) {
      const cf = collectedData.vendorDetections.get('Cloudflare')!;
      log('\n[Cloudflare Analysis]');
      const hasTurnstile = cf.products.some((p) => p.product === 'Turnstile');
      const hasJsChallenge = cf.products.some((p) => p.product === 'JS Challenge');
      if (hasTurnstile) {
        log('  - Turnstile challenge detected (requires human interaction or solver)');
      }
      if (hasJsChallenge) {
        log('  - JavaScript challenge detected (automated solving possible)');
      }
    }

    if (collectedData.vendorDetections.has('HUMAN')) {
      const human = collectedData.vendorDetections.get('HUMAN')!;
      log('\n[HUMAN/PerimeterX Analysis]');
      const hasPressHold = human.products.some((p) => p.product.includes('Press & Hold'));
      if (hasPressHold) {
        log('  - Press & Hold challenge detected');
        log('  - Requires behavioral simulation (mouse hold event)');
      }
    }

    if (collectedData.vendorDetections.has('Imperva')) {
      const imperva = collectedData.vendorDetections.get('Imperva')!;
      log('\n[Imperva/Incapsula Analysis]');
      const hasReese84 = imperva.products.some((p) => p.product.includes('reese84'));
      const hasUtmvc = imperva.products.some((p) => p.product.includes('utmvc'));
      if (hasReese84) {
        log('  - reese84 protection detected');
        log('  - Look for x-d-token header in requests');
      }
      if (hasUtmvc) {
        log('  - utmvc protection detected');
        log('  - Script loaded via /_Incapsula_Resource');
      }
    }

    // Final verdict
    log('\n' + '='.repeat(60));
    log('FINAL RESULT');
    log('='.repeat(60));

    const vendorCount = collectedData.vendorDetections.size;
    const blockedVendors = Array.from(collectedData.vendorDetections.values()).filter((v) => v.isBlocked);
    const blockedPages = collectedData.blockDetections.filter((b) => b.isBlocked);
    const suspiciousPages = collectedData.blockDetections.filter((b) => !b.isBlocked && b.evidence.length > 0);

    // Summary stats
    log(`Vendors detected: ${vendorCount}`);
    log(`Pages blocked: ${blockedPages.length}`);
    if (suspiciousPages.length > 0) {
      log(`Pages with warnings: ${suspiciousPages.length}`);
    }

    // Detailed block status
    if (blockedPages.length > 0) {
      log('\n[BLOCKED PAGES]', 'ERROR');
      for (const block of blockedPages) {
        log(`  ${block.page.toUpperCase()}: ${block.blockType}${block.vendor ? ` (${block.vendor})` : ''} [${block.confidence} confidence]`, 'ERROR');
        block.evidence.slice(0, 3).forEach((e) => log(`    - ${e}`, 'ERROR'));
      }
    }

    if (blockedVendors.length > 0) {
      log('\n[VENDOR BLOCKS]', 'ERROR');
      for (const v of blockedVendors) {
        log(`  ${v.vendor}: ${v.blockReason || 'Blocked'}`, 'ERROR');
      }
    }

    // Final verdict
    log('\n' + '-'.repeat(60));
    const isBlocked = blockedPages.length > 0 || blockedVendors.length > 0;
    const hasSuspicion = suspiciousPages.length > 0;

    if (isBlocked) {
      const blockSources: string[] = [];
      if (blockedPages.length > 0) {
        blockSources.push(...blockedPages.map((b) => `${b.page} (${b.blockType})`));
      }
      if (blockedVendors.length > 0) {
        blockSources.push(...blockedVendors.map((v) => v.vendor));
      }
      log(`RESULT: BLOCKED - ${blockSources.join(', ')}`, 'ERROR');
    } else if (hasSuspicion) {
      log(`RESULT: ${vendorCount} vendor(s) detected, possible blocks detected (review warnings)`, 'WARN');
    } else if (vendorCount === 0) {
      log('RESULT: No bot detection vendors detected');
    } else {
      log(`RESULT: ${vendorCount} vendor(s) detected, no active blocks`);
    }
    log('='.repeat(60));

    collectedData.endTime = new Date().toISOString();

    // Build summary for report
    const summary = {
      isBlocked,
      hasSuspicion,
      verdict: isBlocked 
        ? `BLOCKED - ${[...blockedPages.map((b) => `${b.page} (${b.blockType})`), ...blockedVendors.map((v) => v.vendor)].join(', ')}`
        : hasSuspicion
          ? `${vendorCount} vendor(s) detected, possible blocks detected (review warnings)`
          : vendorCount === 0
            ? 'No bot detection vendors detected'
            : `${vendorCount} vendor(s) detected, no active blocks`,
      vendorCount,
      vendorNames: Array.from(collectedData.vendorDetections.keys()),
      blockedPages: blockedPages.map((b) => ({
        page: b.page,
        blockType: b.blockType,
        vendor: b.vendor,
        confidence: b.confidence,
        evidence: b.evidence,
      })),
      blockedVendors: blockedVendors.map((v) => ({
        vendor: v.vendor,
        reason: v.blockReason,
      })),
      suspiciousPages: suspiciousPages.map((b) => ({
        page: b.page,
        blockType: b.blockType,
        confidence: b.confidence,
        evidence: b.evidence,
      })),
    };

    // Write full report (convert Map to object for JSON serialization)
    const reportData = {
      summary,
      ...collectedData,
      vendorDetections: Object.fromEntries(collectedData.vendorDetections),
    };
    const reportPath = path.join(
      CONFIG.outputDir,
      `report-${Date.now()}.json`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    log(`\nFull report saved to: ${reportPath}`);

    log('='.repeat(60));
    log('Vendor analysis completed successfully');
    log('='.repeat(60));
  } catch (error) {
    log(`Test failed: ${(error as Error).message}`, 'ERROR');
    console.error(error);
    process.exit(1);
  } finally {
    // Use disconnect() not close() — close() destroys remote contexts/pages,
    // disconnect() drops the CDP client while leaving the Kernel session intact.
    if (browser) {
      try {
        await browser.disconnect();
        log('Disconnected from browser (session still active)');
      } catch {
        // Already disconnected
      }
    }
  }
}

// Run the test
runTest().catch(console.error);
