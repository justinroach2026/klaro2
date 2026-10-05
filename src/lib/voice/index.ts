import { type LanguageCode, SUPPORTED_LANGUAGES } from '../../store';
import { aiFetch } from '../ai/client';

const SAMPLE_RATE = 16000;

export class VoiceEngine {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private synthesis: SpeechSynthesis | null = null;

    // VAD (Silence Detection)
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private silenceTimer: number | null = null;
    private animationFrame: number | null = null;
    private hasDetectedSpeech: boolean = false;

    constructor() {
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
        }
    }

    /**
     * Start recording with optional silence detection
     */
    async startRecording(options?: { onSilence?: () => void }): Promise<void> {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            // Ensure AudioContext is active (mobile/safari)
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'audio/webm',
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();

            // Setup VAD if requested
            if (options?.onSilence) {
                this.setupSilenceDetection(this.stream, options.onSilence);
            }

        } catch (error) {
            console.error('Failed to start recording:', error);
            throw new Error('Microphone access denied. Please enable microphone permissions.');
        }
    }

    private setupSilenceDetection(stream: MediaStream, onSilence: () => void) {
        // Initialize AudioContext if needed
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!this.audioContext) {
            this.audioContext = new AudioContextClass();
        } else if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();

        // Settings for speech detection
        this.analyser.minDecibels = -85;
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyser.fftSize = 256;

        source.connect(this.analyser);

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Thresholds
        const SPEECH_THRESHOLD = 20; // Volume level to trigger "Speech Started"
        const SILENCE_THRESHOLD = 12; // Volume level to consider "Silence"
        const SILENCE_DURATION = 2500; // 2.5 seconds of silence triggers stop

        this.hasDetectedSpeech = false;

        const checkVolume = () => {
            if (!this.analyser) return;

            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // VAD Logic:
            // 1. Wait for speech to start (volume > SPEECH_THRESHOLD)
            // 2. If speaking, clear any silence timer.
            // 3. If silence follows speech (volume < SILENCE_THRESHOLD), start timer.

            if (average > SPEECH_THRESHOLD) {
                this.hasDetectedSpeech = true;
                if (this.silenceTimer) {
                    window.clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
            } else if (this.hasDetectedSpeech && average < SILENCE_THRESHOLD) {
                // Silence detected after speech
                if (!this.silenceTimer) {
                    this.silenceTimer = window.setTimeout(() => {
                        onSilence();
                    }, SILENCE_DURATION);
                }
            } else {
                // In-between noise or pre-speech silence
                // If we had a timer running but noise bumped up slightly (but not to SPEECH_THRESHOLD), 
                // we maintain the timer? Or clear it? 
                // Let's be strict: if it's not "quiet enough", reset timer to avoid cutting off.
                if (this.silenceTimer && average >= SILENCE_THRESHOLD) {
                    window.clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
            }

            this.animationFrame = requestAnimationFrame(checkVolume);
        };

        checkVolume();
    }

    /**
     * Stop recording and return audio blob
     */
    async stopRecording(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                // If not recording, resolve with empty to avoid crash
                resolve(new Blob());
                return;
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.cleanup();
                resolve(audioBlob);
            };

            if (this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            } else {
                this.cleanup();
                resolve(new Blob());
            }
        });
    }

    /**
     * Transcribe via the server-side Gemini function (key never reaches the browser)
     */
    async transcribe(audioBlob: Blob, language?: LanguageCode): Promise<{ text: string; detectedLanguage: string }> {
        if (audioBlob.size < 100) return { text: '', detectedLanguage: 'en' };

        const response = await aiFetch('transcribe', {
            audio: await blobToBase64(audioBlob),
            mimeType: 'audio/webm',
            language,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Transcription failed: ${error.error || response.statusText}`);
        }

        const data = await response.json();
        return {
            text: data.text,
            detectedLanguage: language || 'en',
        };
    }

    /**
     * Text to Speech via the server-side Gemini function, falling back to the browser voice
     */
    async speak(text: string, language: LanguageCode): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await aiFetch('speak', { text });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(`TTS failed: ${error.error || response.statusText}`);
                }

                const { audio: base64, mimeType } = await response.json();
                const audioUrl = URL.createObjectURL(base64ToBlob(base64, mimeType));
                const audio = new Audio(audioUrl);

                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };

                audio.onerror = (e) => {
                    URL.revokeObjectURL(audioUrl);
                    reject(e);
                };

                await audio.play();
            } catch (error) {
                console.error('TTS Error:', error);
                // Fallback to basic browser TTS if the server voice fails
                if (this.synthesis) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = SUPPORTED_LANGUAGES[language].code;
                    utterance.onend = () => resolve();
                    utterance.onerror = () => resolve();
                    this.synthesis.speak(utterance);
                } else {
                    resolve();
                }
            }
        });
    }

    stopSpeaking(): void {
        this.synthesis?.cancel();
    }

    private cleanup(): void {
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }
        if (this.silenceTimer) {
            window.clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        // Disconnect analyser but keep context alive for reuse or close it?
        // Better to close context to release mic lock fully
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.mediaRecorder = null;
    }
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
}

export const voiceEngine = new VoiceEngine();
