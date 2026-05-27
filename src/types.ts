export interface CacheEntry<T> {
  value: T;
  expiresAt: number | null; // Unix timestamp in milliseconds when the entry expires, or null if no expiry
}

export interface CacheOptions {
  /**
   * Default Time-To-Live (TTL) in milliseconds for all entries.
   * If not provided, entries will never expire by default unless a specific TTL is passed to `set`.
   */
  defaultTTL?: number;
}
