import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheMan } from '../src/index.js';

describe('CacheMan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should set and get values correctly', () => {
      const cache = new CacheMan<string>();
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new CacheMan<number>();
      expect(cache.get('random')).toBeUndefined();
    });

    it('should accurately report has()', () => {
      const cache = new CacheMan<boolean>();
      cache.set('flag', true);
      expect(cache.has('flag')).toBe(true);
      expect(cache.has('noflag')).toBe(false);
    });

    it('should delete keys and return status', () => {
      const cache = new CacheMan<string>();
      cache.set('a', 'apple');
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.delete('a')).toBe(false); // second delete is false
    });

    it('should clear the cache', () => {
      const cache = new CacheMan<number>();
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.size()).toBe(2);
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });
  });

  describe('TTL (Time to Live) and Lazy Eviction', () => {
    it('should persist forever if no TTL is set and no default TTL exists', () => {
      const cache = new CacheMan<string>();
      cache.set('forever', 'eternal');
      
      vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 365); // 1 year later
      
      expect(cache.get('forever')).toBe('eternal');
      expect(cache.has('forever')).toBe(true);
      expect(cache.size()).toBe(1);
    });

    it('should expire keys with individual TTL', () => {
      const cache = new CacheMan<string>();
      cache.set('temp', 'evanescent', 500); // 500ms TTL
      
      expect(cache.get('temp')).toBe('evanescent');
      
      vi.advanceTimersByTime(499);
      expect(cache.get('temp')).toBe('evanescent'); // not yet expired
      
      vi.advanceTimersByTime(2); // total 501ms passed
      expect(cache.get('temp')).toBeUndefined(); // expired and lazily evicts
      expect(cache.has('temp')).toBe(false);
    });

    it('should use default TTL if specified in options', () => {
      const cache = new CacheMan<string>({ defaultTTL: 1000 });
      cache.set('defaulted', 'standard');
      
      vi.advanceTimersByTime(999);
      expect(cache.get('defaulted')).toBe('standard');
      
      vi.advanceTimersByTime(2);
      expect(cache.get('defaulted')).toBeUndefined();
    });

    it('should override default TTL with individual TTL', () => {
      const cache = new CacheMan<string>({ defaultTTL: 1000 });
      // override with 2000ms TTL
      cache.set('long', 'lengthy', 2000);
      // override with 500ms TTL
      cache.set('short', 'brief', 500);

      vi.advanceTimersByTime(600);
      expect(cache.get('short')).toBeUndefined(); // expired
      expect(cache.get('long')).toBe('lengthy'); // active

      vi.advanceTimersByTime(1000); // total 1600ms
      expect(cache.get('long')).toBe('lengthy'); // active

      vi.advanceTimersByTime(500); // total 2100ms
      expect(cache.get('long')).toBeUndefined(); // expired
    });
  });

  describe('Advanced Features & Helpers', () => {
    it('should return correct remainingTTL()', () => {
      const cache = new CacheMan<string>({ defaultTTL: 1000 });
      
      cache.set('no-ttl', 'infinite', -1); // no ttl
      cache.set('has-ttl', 'value', 5000);

      expect(cache.remainingTTL('non-existent')).toBeUndefined();
      expect(cache.remainingTTL('no-ttl')).toBeNull();
      expect(cache.remainingTTL('has-ttl')).toBe(5000);

      vi.advanceTimersByTime(2000);
      expect(cache.remainingTTL('has-ttl')).toBe(3000);

      vi.advanceTimersByTime(3001);
      expect(cache.remainingTTL('has-ttl')).toBeUndefined(); // expired
    });

    it('should return correct keys() and values() without expired ones', () => {
      const cache = new CacheMan<number>();
      cache.set('a', 1, 500);
      cache.set('b', 2, 2000);
      cache.set('c', 3); // infinite

      expect(cache.keys().sort()).toEqual(['a', 'b', 'c']);
      expect(cache.values().sort()).toEqual([1, 2, 3]);

      vi.advanceTimersByTime(600);
      
      expect(cache.keys().sort()).toEqual(['b', 'c']);
      expect(cache.values().sort()).toEqual([2, 3]);
      expect(cache.size()).toBe(2);
    });

    it('should execute getOrSet with synchronous factory', () => {
      const cache = new CacheMan<number>();
      
      let factoryCalls = 0;
      const factory = () => {
        factoryCalls++;
        return 42;
      };

      // First call (cache miss)
      const res1 = cache.getOrSet('val', factory, 1000);
      expect(res1).toBe(42);
      expect(factoryCalls).toBe(1);

      // Second call (cache hit)
      const res2 = cache.getOrSet('val', factory, 1000);
      expect(res2).toBe(42);
      expect(factoryCalls).toBe(1); // factory not called again

      // Advance time beyond TTL
      vi.advanceTimersByTime(1100);
      
      // Third call (cache miss due to expiry)
      const res3 = cache.getOrSet('val', factory, 1000);
      expect(res3).toBe(42);
      expect(factoryCalls).toBe(2); // factory called again
    });

    it('should execute getOrSet with asynchronous factory', async () => {
      const cache = new CacheMan<string>();
      
      let factoryCalls = 0;
      const factory = async () => {
        factoryCalls++;
        return 'async-value';
      };

      // First call (cache miss)
      const promise1 = cache.getOrSet('async-key', factory, 1000);
      expect(promise1).toBeInstanceOf(Promise);
      
      const res1 = await promise1;
      expect(res1).toBe('async-value');
      expect(factoryCalls).toBe(1);
      expect(cache.get('async-key')).toBe('async-value');

      // Second call (cache hit, returns value immediately since it is now sync-cached)
      const res2 = cache.getOrSet('async-key', factory, 1000);
      expect(res2).toBe('async-value'); // sync cached response!
      expect(factoryCalls).toBe(1);
    });

    it('should manually purge expired items with purgeExpired()', () => {
      const cache = new CacheMan<number>();
      cache.set('a', 1, 100);
      cache.set('b', 2); // infinite

      vi.advanceTimersByTime(150);
      
      // Directly check internal store size prior to public access which cleans lazily
      // We can inspect store using size() which triggers purgeExpired under the hood.
      // But let's verify purgeExpired directly.
      cache.purgeExpired();
      
      // Now we check keys
      expect(cache.keys()).toEqual(['b']);
    });
  });

  describe('Input Validation & Error Handling', () => {
    it('should throw TypeError on invalid defaultTTL constructor option', () => {
      expect(() => new CacheMan({ defaultTTL: -5 })).toThrow(TypeError);
      expect(() => new CacheMan({ defaultTTL: 'invalid' as any })).toThrow(TypeError);
    });

    it('should throw TypeError on invalid set() key and TTL arguments', () => {
      const cache = new CacheMan<any>();
      expect(() => cache.set(123 as any, 'val')).toThrow(TypeError);
      expect(() => cache.set('key', 'val', 'invalid' as any)).toThrow(TypeError);
    });
  });
});
