import { supabase } from '../supabase';

const BUCKET = 'sop-images';
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Uploads step screenshots to `{teamId}/{sopId}/step-{n}.jpg` and returns each storage path
 * (null where there was no frame or the upload failed, so the SOP still saves).
 */
export async function uploadSopImages(teamId: string, sopId: string, frames: (Blob | null)[]): Promise<(string | null)[]> {
    if (!supabase) return frames.map(() => null);
    return Promise.all(frames.map(async (frame, i) => {
        if (!frame) return null;
        const path = `${teamId}/${sopId}/step-${i + 1}.jpg`;
        const { error } = await supabase!.storage.from(BUCKET).upload(path, frame, { contentType: 'image/jpeg', upsert: true });
        if (error) {
            console.warn(`Screenshot ${i + 1} upload failed:`, error.message);
            return null;
        }
        return path;
    }));
}

// Signed URLs are cached until shortly before they expire so re-renders don't re-sign every image.
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getSopImageUrl(path: string): Promise<string | null> {
    const cached = urlCache.get(path);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
    if (!supabase) return null;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return null;
    urlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 });
    return data.signedUrl;
}
