// Purpose: shared behavioral interface for storage providers (Supabase, OCI/S3).
//          Byte-movement only — no URL building, no key construction, no transforms.
// Invariants:
//   * put throws on failure.
//   * remove is idempotent (no-op if object absent).
//   * exists returns false for absent objects, never throws on 404.
// Side effects: none — implementations perform side effects; this type does not.

export interface TStorageProvider {
    /**
     * Upload a byte buffer to the given key.
     * opts.upsert=false: reject if the key already exists (throw).
     * opts.upsert=true:  overwrite silently.
     */
    put(
        key: string,
        body: Buffer,
        contentType: string,
        opts: { upsert: boolean }
    ): Promise<void>;

    /**
     * Delete the object at key. Idempotent — must not throw if absent.
     */
    remove(key: string): Promise<void>;

    /**
     * Return true iff an object exists at key.
     */
    exists(key: string): Promise<boolean>;
}
