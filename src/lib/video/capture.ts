import { MAX_VIDEO_SECONDS } from './limits';

const MIME_CANDIDATES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4', // Safari
];

export class ScreenRecorder {
    private recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private streams: MediaStream[] = [];
    private timer: number | null = null;
    private elapsedMs = 0;
    private lastTick = 0;

    static isSupported(): boolean {
        return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
    }

    /**
     * Captures the chosen screen/window plus the microphone into one stream. The narration is the
     * point of the recording, so a missing microphone is an error rather than a silent video.
     */
    async start(handlers: { onTick: (seconds: number) => void; onAutoStop: () => void }): Promise<void> {
        let display: MediaStream;
        try {
            display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
        } catch {
            throw new Error('Screen sharing was cancelled or blocked. Allow screen capture and try again.');
        }

        let mic: MediaStream;
        try {
            mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch {
            display.getTracks().forEach(t => t.stop());
            throw new Error('Microphone access is needed to capture your narration. Allow it and try again.');
        }

        this.streams = [display, mic];
        const mimeType = MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t));
        this.chunks = [];
        this.recorder = new MediaRecorder(
            new MediaStream([...display.getVideoTracks(), ...mic.getAudioTracks()]),
            { ...(mimeType && { mimeType }), videoBitsPerSecond: 1_500_000 },
        );
        this.recorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
        this.recorder.start(1000);

        // The browser's own "Stop sharing" button ends the video track.
        display.getVideoTracks()[0].onended = () => handlers.onAutoStop();

        this.elapsedMs = 0;
        this.lastTick = Date.now();
        this.timer = window.setInterval(() => {
            if (this.recorder?.state === 'recording') {
                const now = Date.now();
                this.elapsedMs += now - this.lastTick;
            }
            this.lastTick = Date.now();
            const seconds = this.elapsedMs / 1000;
            handlers.onTick(seconds);
            if (seconds >= MAX_VIDEO_SECONDS) handlers.onAutoStop();
        }, 500);
    }

    pause() { this.recorder?.pause(); }
    resume() { this.recorder?.resume(); }
    get isPaused() { return this.recorder?.state === 'paused'; }

    stop(): Promise<{ blob: Blob; seconds: number }> {
        return new Promise(resolve => {
            const recorder = this.recorder;
            const finish = () => {
                const seconds = this.elapsedMs / 1000;
                const blob = new Blob(this.chunks, { type: recorder?.mimeType || 'video/webm' });
                this.release();
                resolve({ blob, seconds });
            };
            if (!recorder || recorder.state === 'inactive') return finish();
            recorder.onstop = finish;
            recorder.stop();
        });
    }

    release() {
        if (this.timer) window.clearInterval(this.timer);
        this.timer = null;
        this.streams.forEach(s => s.getTracks().forEach(t => t.stop()));
        this.streams = [];
        this.recorder = null;
    }
}
