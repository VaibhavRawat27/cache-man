import { CacheEntry, CacheOptions } from './types.js';

export class CacheMan<T = any> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly defaultTTL: number | null = null;

  /**
   * Initializes a new instance of CacheMan.
   * @param options Configuration options for the cache.
   */
  constructor(options?: CacheOptions) {
    if (options?.defaultTTL !== undefined) {
      if (typeof options.defaultTTL !== 'number' || options.defaultTTL < 0 || Number.isNaN(options.defaultTTL)) {
        throw new TypeError('defaultTTL must be a non-negative number');
      }
      this.defaultTTL = options.defaultTTL;
    }
  }

  /**
   * Sets a value in the cache with an optional time-to-live (TTL) in milliseconds.
   * If no TTL is provided, the default TTL is used. If there is no default TTL,
   * the entry will never expire.
   * 
   * @param key The cache key.
   * @param value The value to cache.
   * @param ttl Individual TTL in milliseconds. Overrides default TTL.
   */
  set(key: string, value: T, ttl?: number): void {
    if (typeof key !== 'string') {
      throw new TypeError('Key must be a string');
    }

    let calculatedTTL = this.defaultTTL;

    if (ttl !== undefined) {
      if (typeof ttl !== 'number' || Number.isNaN(ttl)) {
        throw new TypeError('TTL must be a number');
      }
      calculatedTTL = ttl;
    }

    let expiresAt: number | null = null;
    if (calculatedTTL !== null && calculatedTTL >= 0) {
      expiresAt = Date.now() + calculatedTTL;
    }

    this.store.set(key, { value, expiresAt });
  }

  /**
   * Retrieves a value from the cache. If the entry is expired, it will be
   * lazily deleted and undefined will be returned.
   * 
   * @param key The cache key.
   * @returns The cached value, or undefined if not found or expired.
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Checks if a key exists in the cache and is not expired.
   * If the entry is expired, it is lazily deleted.
   * 
   * @param key The cache key.
   * @returns True if the key exists and is active, false otherwise.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Deletes an entry from the cache.
   * If the entry was already expired, it returns false since it was effectively gone.
   * 
   * @param key The cache key.
   * @returns True if the entry existed and was active, false otherwise.
   */
  delete(key: string): boolean {
    if (!this.has(key)) {
      return false;
    }
    return this.store.delete(key);
  }

  /**
   * Clears all entries from the cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Returns the number of active (non-expired) entries in the cache.
   * Lazily purges any expired entries before counting.
   * 
   * @returns Number of active entries.
   */
  size(): number {
    this.purgeExpired();
    return this.store.size;
  }

  /**
   * Returns the remaining Time-To-Live (TTL) of a key in milliseconds.
   * 
   * @param key The cache key.
   * @returns 
   *   - `number` representing milliseconds remaining if the key is active and has a TTL.
   *   - `null` if the key exists but has no TTL (never expires).
   *   - `undefined` if the key does not exist or has expired.
   */
  remainingTTL(key: string): number | null | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    if (entry.expiresAt !== null && now > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    if (entry.expiresAt === null) {
      return null;
    }

    return entry.expiresAt - now;
  }

  /**
   * Retrieves all active (non-expired) keys in the cache.
   * Lazily purges expired keys during the operation.
   * 
   * @returns An array of active keys.
   */
  keys(): string[] {
    this.purgeExpired();
    return Array.from(this.store.keys());
  }

  /**
   * Retrieves all active (non-expired) values in the cache.
   * Lazily purges expired values during the operation.
   * 
   * @returns An array of active values.
   */
  values(): T[] {
    this.purgeExpired();
    return Array.from(this.store.values()).map(entry => entry.value);
  }

  /**
   * Returns the cached value if it exists and is active.
   * Otherwise, calls the factory function to produce a value, stores it in the cache, and returns it.
   * Fully supports both synchronous and asynchronous factory functions with precise type-inference.
   * 
   * @param key The cache key.
   * @param factory Synchronous or asynchronous function to generate the value.
   * @param ttl Optional individual TTL in milliseconds for the newly set cache entry.
   */
  getOrSet<R extends T | Promise<T>>(
    key: string,
    factory: () => R,
    ttl?: number
  ): R extends Promise<T> ? Promise<T> : T {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing as any;
    }

    const value = factory();

    if (value instanceof Promise) {
      return value.then((resolvedValue) => {
        this.set(key, resolvedValue, ttl);
        return resolvedValue;
      }) as any;
    }

    this.set(key, value as T, ttl);
    return value as any;
  }

  /**
   * Manually purges all expired entries from the cache storage.
   * Can be used to free memory or keep size accurate without waiting for access.
   */
  purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Re-export type definitions for user convenience
export * from './types.js';
