/**
 * Upload collection .slc buffer to a configurable PUT URL (e.g. presigned S3/Azure Blob URL).
 * No SDK dependency: plain fetch PUT. User configures URL in settings.
 */

/**
 * Upload buffer to a URL via HTTP PUT. Throws on non-2xx response.
 */
export async function uploadBufferToPutUrl(buffer: Buffer, putUrl: string): Promise<string> {
    const res = await fetch(putUrl, {
        method: 'PUT',
        body: buffer,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(buffer.length),
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upload failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`);
    }
    const location = res.headers.get('Location');
    return location ?? putUrl;
}
