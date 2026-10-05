import { aiFetch } from '../ai/client';

async function errorMessage(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => ({}));
    return body.error || fallback;
}

/** PUTs the bytes to the pre-authorised Google URL, reporting progress. */
function putWithProgress(url: string, file: Blob, onProgress: (fraction: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        // Google's upload endpoint sends no CORS header on its final response, so xhr.onload/onerror
        // are unreliable. `upload.onload` fires when the body is fully sent; processing is verified
        // afterwards by polling video-status.
        xhr.upload.onload = () => resolve();
        xhr.upload.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
        xhr.upload.onabort = () => reject(new Error('Upload cancelled.'));
        xhr.open('PUT', url);
        xhr.setRequestHeader('X-Goog-Upload-Offset', '0');
        xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize');
        xhr.send(file);
    });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Uploads the video to Gemini and waits until it is ready to analyse. Returns the handle used by video-to-sop. */
export async function uploadVideo(file: Blob, onProgress: (fraction: number) => void): Promise<{ displayName: string }> {
    const mimeType = file.type.split(';')[0] || 'video/webm';
    const sessionRes = await aiFetch('video-upload-session', { mimeType, sizeBytes: file.size });
    if (!sessionRes.ok) throw new Error(await errorMessage(sessionRes, 'Could not start the upload'));
    const { uploadUrl, displayName } = await sessionRes.json();

    await putWithProgress(uploadUrl, file, onProgress);

    // Finalising and processing happen on Google's side; a brief MISSING right after upload is normal.
    const deadline = Date.now() + 5 * 60_000;
    let missingSince: number | null = null;
    while (Date.now() < deadline) {
        const res = await aiFetch('video-status', { displayName, sizeBytes: file.size });
        if (!res.ok) throw new Error(await errorMessage(res, 'Could not check the upload'));
        const { state } = await res.json();
        if (state === 'ACTIVE') return { displayName };
        if (state === 'FAILED') throw new Error('The video could not be processed. Try a different file or re-record it.');
        if (state === 'MISSING') {
            missingSince ??= Date.now();
            if (Date.now() - missingSince > 30_000) throw new Error('The upload did not complete. Please try again.');
        } else {
            missingSince = null;
        }
        await sleep(2000);
    }
    throw new Error('Processing the video took too long. Please try again.');
}
