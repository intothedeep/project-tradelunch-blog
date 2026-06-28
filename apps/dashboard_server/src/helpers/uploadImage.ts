// Purpose: server-to-server upload of an image buffer to Supabase Storage via the
//          REST object API (native fetch, no supabase-js). The browser never talks
//          to Supabase directly — this is the only writer to the bucket.
// Invariants:
//   * Uses the SECRET key as a bearer; `x-upsert: false` so an existing object is
//     never silently overwritten (the path already carries a uniqueness suffix).
//   * publicUrl mirrors the feed read join: `${publicBase}/${bucket}/${path}`.
//   * A non-2xx response is reported as { ok:false, reason } — never thrown.
// Side effects: a single network POST to Supabase Storage.

export type TUploadConfig = {
    supabaseUrl: string;
    secretKey: string;
    bucket: string;
    publicBase: string;
};

export type TUploadResult =
    | { ok: true; value: { publicUrl: string } }
    | { ok: false; reason: string };

export async function uploadImageToStorage(
    config: TUploadConfig,
    path: string,
    buffer: Buffer,
    contentType: string
): Promise<TUploadResult> {
    const endpoint = `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${path}`;

    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.secretKey}`,
                'Content-Type': contentType,
                'x-upsert': 'false',
            },
            body: new Uint8Array(buffer),
        });
    } catch (error) {
        return { ok: false, reason: `storage upload error (${String(error)})` };
    }

    if (!response.ok) {
        return {
            ok: false,
            reason: `storage upload failed (${response.status})`,
        };
    }

    const publicUrl = `${config.publicBase}/${config.bucket}/${path}`;
    return { ok: true, value: { publicUrl } };
}
