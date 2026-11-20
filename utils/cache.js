/**
 * Lightweight in-memory TTL cache for hot, rarely-mutated read queries
 * (e.g., admin sidebar counts, active categories, user header badge counts).
 */

const store = new Map();

export const getCache = (key) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.value;
};

export const setCache = (key, value, ttlMs = 30000) => {
    store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
    });
    return value;
};

export const deleteCache = (key) => {
    store.delete(key);
};

export const clearCachePrefix = (prefix) => {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
        }
    }
};

export const invalidateAdminSidebarCache = () => {
    deleteCache("admin:sidebarCounts");
};

export const invalidateCatalogCache = () => {
    clearCachePrefix("catalog:");
    invalidateAdminSidebarCache();
};

export const invalidateUserBadgeCache = (userId) => {
    if (!userId) return;
    deleteCache(`user:badges:${userId.toString()}`);
};

export default {
    getCache,
    setCache,
    deleteCache,
    clearCachePrefix,
    invalidateAdminSidebarCache,
    invalidateCatalogCache,
    invalidateUserBadgeCache
};
