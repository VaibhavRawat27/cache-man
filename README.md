# @rawatvaibhavdev/cache-man ⚡️

[![NPM Version](https://img.shields.io/npm/v/%40rawatvaibhavdev%2Fcache-man.svg?style=flat-rounded)](https://www.npmjs.com/package/%40rawatvaibhavdev%2Fcache-man)
[![License](https://img.shields.io/npm/l/%40rawatvaibhavdev%2Fcache-man.svg?style=flat-rounded)](https://github.com/VaibhavRawat27/cache-man/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/%40rawatvaibhavdev%2Fcache-man?style=flat-rounded)](https://bundlephobia.com/package/%40rawatvaibhavdev%2Fcache-man)
[![Types](https://img.shields.io/npm/types/%40rawatvaibhavdev%2Fcache-man?style=flat-rounded)](https://www.npmjs.com/package/%40rawatvaibhavdev%2Fcache-man)

An ultra-lightweight, zero-dependency, type-safe, in-memory TTL (Time-To-Live) cache library for Node.js and browser environments. Written in TypeScript, compiled to both ES Modules (ESM) and CommonJS (CJS).

---

## 🌐 Documentation (GitHub Pages)

📚 A clean, static documentation site is available at: https://vaibhavrawat27.github.io/cache-man

---

## 🌟 Why `cache-man`?

In modern JavaScript development, caching is vital for speed and efficiency. However, existing options often introduce unnecessary complexity:

*   **Redis** is powerful but requires a running server, network latency, connection handshakes, and infrastructure maintenance. It's overkill for basic inside-process caching.
*   **node-cache** is popular but has dependencies, depends on Node-specific APIs (preventing browser/frontend framework use), and runs persistent background timers (`setInterval`) that can prevent Node.js processes from exiting cleanly during serverless executions (like AWS Lambda or Vercel Functions).

### The `cache-man` Advantage:
1.  **Zero Dependencies**: Extreme lightweight footprint (minified bundle under **2KB**).
2.  **Universal Compatibility**: Works everywhere! Native ESM & CommonJS support. Runs in Node.js, browsers (React, Vue, Svelte, Angular), Cloudflare Workers, Bun, Deno, and Chrome Extensions.
3.  **Lazy Invalidation by Default**: Expired keys are invalidated and deleted *lazily on access* (during `get`, `has`, `size`, `keys`, `values`, `remainingTTL`). No persistent background interval timers are created, making it perfectly suited for serverless/edge environments.
4.  **Full Type Safety**: Generics support allows you to declare exact cache value types, ensuring compiler-level type safety.
5.  **Compute Caching**: Native support for computed values (`getOrSet`) that seamlessly handles both synchronous and asynchronous functions.

---

## 📦 Installation

Install via your preferred package manager:

```bash
# npm
npm i @rawatvaibhavdev/cache-man

# yarn
yarn add @rawatvaibhavdev/cache-man

# pnpm
pnpm add @rawatvaibhavdev/cache-man

# bun
bun add @rawatvaibhavdev/cache-man
```

---

## 🚀 Quickstart

```typescript
import { CacheMan } from 'cache-man';

// Initialize cache with type safety and a default TTL of 5 seconds (5000ms)
const cache = new CacheMan<string>({ defaultTTL: 5000 });

// Set key-value pairs
cache.set('user:session', 'token_abcdef123');

// Retrieve values
console.log(cache.get('user:session')); // 'token_abcdef123'

// Individual TTL overrides default (expires in 1 second)
cache.set('temp_code', '998822', 1000);

// Wait 1.1 seconds
setTimeout(() => {
  console.log(cache.get('temp_code')); // undefined (lazily evicted!)
}, 1100);
```

---

## 🛠️ Complete API Reference

### `new CacheMan<T>(options?: CacheOptions)`
Initializes the cache instance.
*   `T`: Generic type parameter defining the cached value type (defaults to `any`).
*   `options.defaultTTL` *(optional)*: Default TTL in milliseconds for all keys. If not provided, keys will never expire by default.

### `set(key: string, value: T, ttl?: number): void`
Saves an item to the cache.
*   `key`: Must be a string.
*   `value`: The item to store.
*   `ttl` *(optional)*: Key-specific TTL in milliseconds. Overrides `defaultTTL`. If set to `<= 0` or `undefined`, the key will never expire (unless `defaultTTL` is set).

### `get(key: string): T | undefined`
Retrieves a cached value.
*   Returns the value if it exists and is active.
*   If the value has expired, it is lazily deleted and `undefined` is returned.

### `has(key: string): boolean`
Checks if a key exists and is active.
*   If the value is expired, it is lazily deleted and returns `false`.

### `delete(key: string): boolean`
Deletes a key from the cache.
*   Returns `true` if the key existed and was active; `false` otherwise.

### `clear(): void`
Clears all entries from the cache memory.

### `size(): number`
Returns the count of active (non-expired) items. Automatically purges all expired keys before calculating.

### `remainingTTL(key: string): number | null | undefined`
Inspects remaining life of a key in milliseconds.
*   Returns `number` representing milliseconds remaining if active and has a TTL.
*   Returns `null` if the key is active but has no TTL (never expires).
*   Returns `undefined` if the key doesn't exist or is already expired.

### `keys(): string[]`
Returns an array of all active (non-expired) keys. Purges expired keys during invocation.

### `values(): T[]`
Returns an array of all active (non-expired) values. Purges expired keys during invocation.

### `getOrSet<R extends T | Promise<T>>(key: string, factory: () => R, ttl?: number): R extends Promise<T> ? Promise<T> : T`
Computed caching helper. Retrieves the key; if it is missing or expired, executes the factory, caches the result with the given TTL, and returns it.
*   **Fully supports synchronous and asynchronous factories** with perfect compile-time type-inference.

### `purgeExpired(): void`
Manually sweeps the entire cache map and deletes all expired entries. Use this if you want to aggressively free memory without waiting for lazy invalidations.

---

## 💡 Real-World Production Scenarios

### 1. API Response Caching (HTTP Client)
Prevent duplicate high-latency HTTP requests for slow endpoints.

```typescript
import { CacheMan } from 'cache-man';

interface WeatherReport {
  temp: number;
  condition: string;
}

const weatherCache = new CacheMan<WeatherReport>({ defaultTTL: 10 * 60 * 1000 }); // 10 minutes cache

async function fetchWeather(city: string): Promise<WeatherReport> {
  const cacheKey = `weather:${city.toLowerCase()}`;

  // getOrSet automatically handles async factory, registers it in cache, and returns it
  return weatherCache.getOrSet(cacheKey, async () => {
    console.log(`fetching fresh weather data for ${city}...`);
    const response = await fetch(`https://api.weather.com/v1/${city}`);
    const data = await response.json();
    return {
      temp: data.temperature,
      condition: data.condition
    };
  });
}
```

### 2. Micro Rate Limiting (Express Middleware)
Mitigate DDoS/scraping by tracking IP hit counts in short windows.

```typescript
import express from 'express';
import { CacheMan } from 'cache-man';

const app = express();
const rateLimiter = new CacheMan<number>();
const LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  const currentHits = rateLimiter.get(ip) || 0;

  if (currentHits >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Increment hit count. Key resets every 1 minute
  rateLimiter.set(ip, currentHits + 1, LIMIT_WINDOW);
  next();
});
```

### 3. Temporary OTP (One-Time Password) Storage
Cache authentication codes for a brief duration.

```typescript
import { CacheMan } from 'cache-man';

const otpCache = new CacheMan<string>({ defaultTTL: 3 * 60 * 1000 }); // 3 minutes expiration

function generateAndSaveOTP(userId: string): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpCache.set(userId, otp);
  return otp;
}

function verifyOTP(userId: string, inputOtp: string): boolean {
  const cachedOtp = otpCache.get(userId);
  if (cachedOtp && cachedOtp === inputOtp) {
    otpCache.delete(userId); // Invalidate immediately upon successful verification
    return true;
  }
  return false;
}
```

### 4. Temporary Browser Session State Storage
Cache heavy state objects in modern frontend applications.

```typescript
import { CacheMan } from 'cache-man';

interface UserPreferences {
  theme: 'dark' | 'light';
  dashboardLayout: string[];
}

// Prefs cached for 30 minutes in memory to avoid constant localstorage parsing
const preferenceCache = new CacheMan<UserPreferences>({ defaultTTL: 30 * 60 * 1000 });

export function getUserPrefs(userId: string): UserPreferences {
  return preferenceCache.getOrSet(`prefs:${userId}`, () => {
    const raw = localStorage.getItem(`prefs_${userId}`);
    return raw ? JSON.parse(raw) : { theme: 'dark', dashboardLayout: [] };
  });
}
```

---

## 🧩 Chrome Browser Extension Architecture Design

Chrome Extension environments (Manifest V3) introduce specific architectural constraints:
1.  **Service Workers (Background Scripts)** are ephemeral. They start up when events are fired and sleep when inactive, destroying in-memory variable scopes.
2.  **Multiple Contexts**: Extenions run in multiple separate JS processes (Background Service Worker, Popups/Options panels, and Content Scripts injected into web pages). Memory cannot be shared directly.

### 📐 Suggested Extension Integration Pattern

To solve the ephemeral worker problem and process boundaries, use a **Dual-Layered Bridged Caching Architecture** where `CacheMan` acts as a fast L1 memory cache and Chrome's async local storage acts as L2 persistence.

#### Architectural Diagram

```text
  ┌──────────────────────────────────────────────────────────────┐
  │                 CHROME EXTENSION RUNTIME                     │
  │                                                              │
  │   ┌──────────────────┐            ┌──────────────────────┐   │
  │   │  Popup Window    │            │ Content Scripts      │   │
  │   │  (Memory Cache)  │            │ (Memory Cache)       │   │
  │   └────────┬─────────┘            └──────────┬───────────┘   │
  │            │ IPC Message                     │ IPC Message   │
  │            └────────────────┬────────────────┘               │
  │                             ▼                                │
  │            ┌──────────────────────────────────┐              │
  │            │   Background Service Worker      │              │
  │            │                                  │              │
  │            │  L1: CacheMan (Ultra-fast RAM)   │              │
  │            │        │                         │              │
  │            │        │ Write-Through           │              │
  │            │        ▼                         │              │
  │            │  L2: chrome.storage.local (Disk) │              │
  │            └──────────────────────────────────┘              │
  └──────────────────────────────────────────────────────────────┘
```

#### Complete Integration Pattern Implementation

Create a hybrid `ChromeExtensionCache` class that encapsulates `CacheMan` with storage persistence. This provides synchronous local memory lookups when the service worker is hot, and falls back to asynchronously restoring the cache state when waking up from suspension.

Create a file named `extensionCache.ts`:

```typescript
import { CacheMan, CacheEntry } from 'cache-man';

export class ChromeExtensionCache<T> {
  private cache: CacheMan<T>;
  private storageKey: string;
  private isLoaded: Promise<void>;

  constructor(namespace: string, defaultTTL?: number) {
    this.cache = new CacheMan<T>({ defaultTTL });
    this.storageKey = `cacheman_store:${namespace}`;
    
    // Automatically load persisted cache from disk on startup
    this.isLoaded = this.hydrateFromDisk();
  }

  /**
   * Restores cache state from Chrome Storage into memory.
   */
  private async hydrateFromDisk(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        const stored = result[this.storageKey];
        if (stored && typeof stored === 'object') {
          const now = Date.now();
          // Hydrate only non-expired elements
          Object.entries(stored).forEach(([key, entry]) => {
            const cacheEntry = entry as CacheEntry<T>;
            if (cacheEntry.expiresAt === null || now <= cacheEntry.expiresAt) {
              // Inject directly into CacheMan store mapping
              this.cache.set(
                key, 
                cacheEntry.value, 
                cacheEntry.expiresAt ? cacheEntry.expiresAt - now : undefined
              );
            }
          });
        }
        resolve();
      });
    });
  }

  /**
   * Persists the active cache state back to chrome.storage.
   */
  private async saveToDisk(): Promise<void> {
    // Collect active keys
    const activeKeys = this.cache.keys();
    const dataToStore: Record<string, CacheEntry<T>> = {};

    activeKeys.forEach((key) => {
      const val = this.cache.get(key);
      const remaining = this.cache.remainingTTL(key);
      
      if (val !== undefined) {
        dataToStore[key] = {
          value: val,
          expiresAt: remaining !== null && remaining !== undefined ? Date.now() + remaining : null
        };
      }
    });

    await chrome.storage.local.set({ [this.storageKey]: dataToStore });
  }

  /**
   * Safe set operation. Memory cache write-through to disk.
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    await this.isLoaded;
    this.cache.set(key, value, ttl);
    await this.saveToDisk();
  }

  /**
   * Safe get operation. Tries memory cache first.
   */
  async get(key: string): Promise<T | undefined> {
    await this.isLoaded;
    const memoryVal = this.cache.get(key);
    if (memoryVal !== undefined) {
      return memoryVal;
    }
    // If not in memory (might have been pruned or lazily deleted), ensure disk matches
    await this.saveToDisk();
    return undefined;
  }

  /**
   * Delete entry from both memory and disk storage.
   */
  async delete(key: string): Promise<boolean> {
    await this.isLoaded;
    const deleted = this.cache.delete(key);
    if (deleted) {
      await this.saveToDisk();
    }
    return deleted;
  }
}
```

#### Usage in Service Worker (`background.ts`)

```typescript
import { ChromeExtensionCache } from './extensionCache.js';

// Cache weather API responses in extension background for 5 mins
const apiCache = new ChromeExtensionCache<any>('api_requests', 5 * 60 * 1000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchData') {
    (async () => {
      const cacheKey = `url:${message.url}`;
      
      // Look up cached result
      const cached = await apiCache.get(cacheKey);
      if (cached) {
        console.log('Serving response from Extension Cache...');
        sendResponse({ success: true, data: cached, fromCache: true });
        return;
      }

      // Fresh fetch
      try {
        const response = await fetch(message.url);
        const data = await response.json();
        
        // Cache response before returning
        await apiCache.set(cacheKey, data);
        sendResponse({ success: true, data, fromCache: false });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
});
```

---

## 📜 License

[MIT](LICENSE)
