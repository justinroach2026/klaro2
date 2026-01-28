import { type LanguageCode, SUPPORTED_LANGUAGES } from '../../store';

// Audio recording configuration
const SAMPLE_RATE = 16000; // Whisper API prefers 16kHz

export class VoiceEngine {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private synthesis: SpeechSynthesis | null = null;

    constructor() {
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
        }
    }

    /**
     * Request microphone permission and start recording
     */
    async startRecording(): Promise<void> {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

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
        } catch (error) {
            console.error('Failed to start recording:', error);
            throw new Error('Microphone access denied. Please enable microphone permissions.');
        }
    }

    /**
     * Stop recording and return audio blob
     */
    async stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('No recording in progress'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.cleanup();
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Transcribe audio using OpenAI Whisper API
     */
    async transcribe(audioBlob: Blob, language?: LanguageCode): Promise<{ text: string; detectedLanguage: string }> {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-1');

        if (language) {
            // Hint Whisper with the expected language
            formData.append('language', language);
        }

        // This will be called via Supabase Edge Function to hide API key
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Transcription failed');
        }

        const data = await response.json();
        return {
            text: data.text,
            detectedLanguage: data.language || language || 'en',
        };
    }

    /**
     * Convert text to speech using Web Speech API (free!)
     */
    async speak(text: string, language: LanguageCode): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.synthesis) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }

            // Cancel any ongoing speech
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = SUPPORTED_LANGUAGES[language].code;
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Try to find a native voice for the language
            const voices = this.synthesis.getVoices();
            const languageVoice = voices.find(
                (voice) => voice.lang.startsWith(language)
            );

            if (languageVoice) {
                utterance.voice = languageVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (error) => reject(error);

            this.synthesis.speak(utterance);
        });
    }

    /**
     * Stop speaking
     */
    stopSpeaking(): void {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    }

    /**
     * Check if currently speaking
     */
    isSpeaking(): boolean {
        return this.synthesis ? this.synthesis.speaking : false;
    }

    /**
     * Get available voices for a language
     */
    getVoices(language?: LanguageCode): SpeechSynthesisVoice[] {
        if (!this.synthesis) return [];

        const voices = this.synthesis.getVoices();

        if (language) {
            return voices.filter((voice) => voice.lang.startsWith(language));
        }

        return voices;
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }
        this.mediaRecorder = null;
    }
}

// Singleton instance
export const voiceEngine = new VoiceEngine();
