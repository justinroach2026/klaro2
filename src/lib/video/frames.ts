const MAX_FRAME_WIDTH = 1280;
const SEEK_TIMEOUT_MS = 8000;

function once(target: HTMLVideoElement, event: string, timeoutMs = SEEK_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => { target.removeEventListener(event, onEvent); reject(new Error(`Video ${event} timed out`)); }, timeoutMs);
        const onEvent = () => { window.clearTimeout(timer); resolve(); };
        target.addEventListener(event, onEvent, { once: true });
    });
}

/** Loads a video blob and makes it seekable. Returns the element, its duration and a cleanup function. */
async function loadVideo(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    await once(video, 'loadedmetadata', 15000);

    // MediaRecorder output has no duration header (Infinity). Seeking far past the end forces the
    // browser to scan the file, after which duration is real and seeking works.
    if (!Number.isFinite(video.duration)) {
        video.currentTime = 1e101;
        await once(video, 'timeupdate', 15000);
        video.currentTime = 0;
        await once(video, 'seeked', 15000).catch(() => undefined);
    }
    return { video, duration: video.duration, dispose: () => URL.revokeObjectURL(url) };
}

export async function getVideoDuration(blob: Blob): Promise<number> {
    const { duration, dispose } = await loadVideo(blob);
    dispose();
    return duration;
}

/**
 * Grabs a JPEG screenshot at each timestamp. A frame that can't be captured is null so the SOP
 * can still be saved with text for that step.
 */
export async function extractFrames(
    blob: Blob,
    timestamps: number[],
    onProgress?: (done: number, total: number) => void,
): Promise<(Blob | null)[]> {
    const { video, duration, dispose } = await loadVideo(blob);
    const scale = Math.min(1, MAX_FRAME_WIDTH / (video.videoWidth || MAX_FRAME_WIDTH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');

    const frames: (Blob | null)[] = [];
    try {
        for (const [i, ts] of timestamps.entries()) {
            try {
                if (!ctx || !canvas.width) throw new Error('No canvas');
                video.currentTime = Math.min(Math.max(ts, 0), Math.max(duration - 0.1, 0));
                await once(video, 'seeked');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.8)));
            } catch (error) {
                console.warn(`Could not capture frame at ${ts}s:`, error);
                frames.push(null);
            }
            onProgress?.(i + 1, timestamps.length);
        }
    } finally {
        dispose();
    }
    return frames;
}
