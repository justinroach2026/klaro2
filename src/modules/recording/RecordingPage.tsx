import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Loader2, Pause, Play, ShieldAlert, Square, TriangleAlert, Upload, Video } from 'lucide-react';
import {
    useStore, SUPPORTED_COUNTRIES, SUPPORTED_INDUSTRIES, SUPPORTED_LANGUAGES,
    type CountryCode, type IndustryCode, type LanguageCode,
} from '../../store';
import { createDraftSOP, saveDraftSOP } from '../../lib/supabase';
import { aiFetch } from '../../lib/ai/client';
import { ScreenRecorder } from '../../lib/video/capture';
import { uploadVideo } from '../../lib/video/upload';
import { extractFrames, getVideoDuration } from '../../lib/video/frames';
import { uploadSopImages } from '../../lib/video/images';
import { composeSopMarkdown, type VideoSOP } from '../../lib/video/compose';
import { ACCEPTED_VIDEO_TYPES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, formatClock } from '../../lib/video/limits';

type Phase = 'setup' | 'recording' | 'review' | 'working' | 'done';
type Stage = 'upload' | 'analyse' | 'screenshots' | 'save';

const STAGES: { id: Stage; label: string }[] = [
    { id: 'upload', label: 'Uploading video' },
    { id: 'analyse', label: 'Watching and listening to the process' },
    { id: 'screenshots', label: 'Capturing screenshots for each step' },
    { id: 'save', label: 'Saving your draft' },
];

const selectClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#137fec]';

export default function RecordingPage() {
    const navigate = useNavigate();
    const {
        user, profile,
        selectedLanguage, selectedIndustry, selectedCountry,
        setSelectedLanguage, setSelectedIndustry, setSelectedCountry,
    } = useStore();

    const [phase, setPhase] = useState<Phase>('setup');
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [seconds, setSeconds] = useState(0);
    const [paused, setPaused] = useState(false);
    const [video, setVideo] = useState<{ blob: Blob; seconds: number } | null>(null);
    const [stage, setStage] = useState<Stage>('upload');
    const [uploadFraction, setUploadFraction] = useState(0);
    const [sopId, setSopId] = useState<string | null>(null);

    const recorder = useRef<ScreenRecorder | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const previewUrl = useMemo(() => (video ? URL.createObjectURL(video.blob) : null), [video]);

    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
    useEffect(() => () => recorder.current?.release(), []);

    // Same defaults as the interview flow: the profile's saved industry/country.
    useEffect(() => {
        if (profile?.industry) setSelectedIndustry(profile.industry);
        if (profile?.country) setSelectedCountry(profile.country);
    }, [profile?.industry, profile?.country, setSelectedIndustry, setSelectedCountry]);

    const isViewer = profile?.role === 'viewer';

    const startRecording = async () => {
        setError(null);
        const rec = new ScreenRecorder();
        recorder.current = rec;
        try {
            await rec.start({ onTick: setSeconds, onAutoStop: () => void stopRecording() });
            setSeconds(0);
            setPaused(false);
            setPhase('recording');
        } catch (err) {
            recorder.current = null;
            setError(err instanceof Error ? err.message : 'Could not start recording');
        }
    };

    const stopRecording = async () => {
        const rec = recorder.current;
        if (!rec) return;
        recorder.current = null;
        const result = await rec.stop();
        if (result.blob.size < 1000) {
            setError('Nothing was recorded. Please try again.');
            setPhase('setup');
            return;
        }
        setVideo(result);
        setPhase('review');
    };

    const togglePause = () => {
        const rec = recorder.current;
        if (!rec) return;
        if (rec.isPaused) rec.resume(); else rec.pause();
        setPaused(rec.isPaused);
    };

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setError(null);
        if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
            setError('Unsupported file type. Use an MP4, WebM or MOV video.');
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            setError('That video is larger than 500 MB. Trim it or record a shorter one.');
            return;
        }
        try {
            const duration = await getVideoDuration(file);
            if (duration > MAX_VIDEO_SECONDS) {
                setError(`That video is ${formatClock(duration)} long. The limit is ${MAX_VIDEO_SECONDS / 60} minutes.`);
                return;
            }
            setVideo({ blob: file, seconds: duration });
            setPhase('review');
        } catch {
            setError('This browser could not read that video. Try an MP4 or WebM file.');
        }
    };

    const generate = async () => {
        if (!video || !user || !profile?.team_id) {
            setError('Your profile is still loading. Please try again in a moment.');
            return;
        }
        setError(null);
        setWarning(null);
        setPhase('working');
        setUploadFraction(0);

        try {
            setStage('upload');
            const { displayName } = await uploadVideo(video.blob, setUploadFraction);

            setStage('analyse');
            const res = await aiFetch('video-to-sop', {
                displayName,
                language: selectedLanguage,
                industry: selectedIndustry,
                country: SUPPORTED_COUNTRIES[selectedCountry].name,
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'The analysis failed');
            const { sop } = (await res.json()) as { sop: VideoSOP };

            setStage('screenshots');
            const frames = await extractFrames(video.blob, sop.steps.map(s => s.timestampSeconds));

            setStage('save');
            // Create the draft first: screenshot paths include its id.
            const draftId = await createDraftSOP({
                teamId: profile.team_id,
                userId: user.id,
                title: sop.title,
                content: `# ${sop.title}\n`,
                tags: ['screen-recording'],
                language: selectedLanguage,
            });
            const imagePaths = await uploadSopImages(profile.team_id, draftId, frames);
            await saveDraftSOP({
                draftId,
                teamId: profile.team_id,
                userId: user.id,
                title: sop.title,
                content: composeSopMarkdown(sop, imagePaths),
                tags: ['screen-recording'],
                language: selectedLanguage,
            });

            const missing = imagePaths.filter(p => !p).length;
            setSopId(draftId);
            if (missing > 0) {
                setWarning(`${missing} of ${imagePaths.length} screenshots couldn't be captured, so those steps are text-only. You can add images in the editor.`);
                setPhase('done');
            } else {
                navigate(`/sop/${draftId}`, { replace: true });
            }
        } catch (err) {
            // Keep the recording so the user can retry without re-recording.
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setPhase('review');
        }
    };

    const reset = () => { setVideo(null); setError(null); setPhase('setup'); };

    if (isViewer) {
        return (
            <Shell>
                <Card>
                    <p className="text-gray-700 text-sm">Only Creator accounts can create SOPs.</p>
                    <button onClick={() => navigate('/dashboard')} className="mt-4 text-[#137fec] font-bold text-sm">Back to dashboard</button>
                </Card>
            </Shell>
        );
    }

    return (
        <Shell>
            {phase === 'setup' && (
                <Card>
                    <Header onBack={() => navigate('/dashboard')} title="Create SOP from a recording" subtitle="Show the process on screen and explain it out loud. Klaro turns it into a step-by-step SOP with a screenshot for each step." />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                        <Field label="SOP language">
                            <select className={selectClass} value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value as LanguageCode)}>
                                {Object.entries(SUPPORTED_LANGUAGES).map(([code, l]) => <option key={code} value={code}>{l.nativeName}</option>)}
                            </select>
                        </Field>
                        <Field label="Industry">
                            <select className={selectClass} value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value as IndustryCode)}>
                                {Object.entries(SUPPORTED_INDUSTRIES).map(([code, i]) => <option key={code} value={code}>{i.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Country">
                            <select className={selectClass} value={selectedCountry} onChange={e => setSelectedCountry(e.target.value as CountryCode)}>
                                {Object.entries(SUPPORTED_COUNTRIES).map(([code, c]) => <option key={code} value={code}>{c.flag} {c.name}</option>)}
                            </select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        <button
                            onClick={startRecording}
                            disabled={!ScreenRecorder.isSupported()}
                            className="flex flex-col items-start gap-2 p-5 rounded-2xl bg-[#137fec] text-white text-left hover:bg-[#0f66bd] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Video className="w-6 h-6" />
                            <span className="font-black">Record my screen</span>
                            <span className="text-white/70 text-xs">Up to {MAX_VIDEO_SECONDS / 60} minutes. You'll choose what to share and use your microphone.</span>
                        </button>
                        <button
                            onClick={() => fileInput.current?.click()}
                            className="flex flex-col items-start gap-2 p-5 rounded-2xl border-2 border-dashed border-gray-300 text-gray-800 text-left hover:border-[#137fec] hover:bg-blue-50 transition-all"
                        >
                            <Upload className="w-6 h-6 text-[#137fec]" />
                            <span className="font-black">Upload a video</span>
                            <span className="text-gray-500 text-xs">MP4, WebM or MOV, up to 500 MB. The narration must be in the video.</span>
                        </button>
                        <input ref={fileInput} type="file" accept={ACCEPTED_VIDEO_TYPES.join(',')} className="hidden" onChange={e => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </div>
                    {!ScreenRecorder.isSupported() && <p className="text-xs text-amber-600 mt-3">This browser can't record the screen. Use Chrome, Edge or Safari on a computer, or upload a video.</p>}

                    <PrivacyNote />
                    <ErrorBanner message={error} />
                </Card>
            )}

            {phase === 'recording' && (
                <Card>
                    <div className="flex flex-col items-center py-6">
                        <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                            <Circle className={`w-3 h-3 fill-red-600 ${paused ? '' : 'animate-pulse'}`} />
                            {paused ? 'Paused' : 'Recording'}
                        </div>
                        <div className="text-6xl font-black text-gray-900 tabular-nums mt-3">{formatClock(seconds)}</div>
                        <p className="text-gray-500 text-sm mt-2 text-center max-w-sm">Do the process on your screen and say what you're doing and why. Mention rules and common mistakes as you go.</p>
                        <div className="flex gap-3 mt-8">
                            <button onClick={togglePause} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50">
                                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                {paused ? 'Resume' : 'Pause'}
                            </button>
                            <button onClick={() => void stopRecording()} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700">
                                <Square className="w-4 h-4 fill-white" /> Finish
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-4">Recording stops automatically at {MAX_VIDEO_SECONDS / 60} minutes.</p>
                    </div>
                </Card>
            )}

            {phase === 'review' && video && previewUrl && (
                <Card>
                    <Header onBack={reset} title="Review your recording" subtitle={`${formatClock(video.seconds)} · ${(video.blob.size / 1024 / 1024).toFixed(1)} MB`} />
                    <video src={previewUrl} controls className="w-full rounded-xl bg-black mt-5 max-h-[360px]" />
                    <ErrorBanner message={error} />
                    <div className="flex flex-col sm:flex-row gap-3 mt-5">
                        <button onClick={reset} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50">Start over</button>
                        <button onClick={() => void generate()} className="flex-1 py-3 rounded-xl bg-[#137fec] text-white font-bold text-sm hover:bg-[#0f66bd]">
                            {error ? 'Try again' : 'Generate SOP'}
                        </button>
                    </div>
                    <PrivacyNote />
                </Card>
            )}

            {phase === 'working' && (
                <Card>
                    <h2 className="text-xl font-black text-gray-900">Building your SOP…</h2>
                    <p className="text-gray-500 text-sm mt-1">Keep this tab open. Longer recordings take a few minutes.</p>
                    <ul className="mt-6 space-y-4">
                        {STAGES.map((s, i) => {
                            const current = STAGES.findIndex(x => x.id === stage);
                            const state = i < current ? 'done' : i === current ? 'active' : 'pending';
                            return (
                                <li key={s.id} className="flex items-center gap-3">
                                    {state === 'done' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                    {state === 'active' && <Loader2 className="w-5 h-5 text-[#137fec] animate-spin" />}
                                    {state === 'pending' && <Circle className="w-5 h-5 text-gray-300" />}
                                    <span className={`text-sm font-medium ${state === 'pending' ? 'text-gray-400' : 'text-gray-800'}`}>
                                        {s.label}{s.id === 'upload' && state === 'active' ? ` (${Math.round(uploadFraction * 100)}%)` : ''}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}

            {phase === 'done' && (
                <Card>
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                        <h2 className="text-xl font-black text-gray-900">Your draft is ready</h2>
                    </div>
                    {warning && (
                        <p className="flex gap-2 mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" /> {warning}
                        </p>
                    )}
                    <button onClick={() => navigate(`/sop/${sopId}`, { replace: true })} className="mt-6 w-full py-3 rounded-xl bg-[#137fec] text-white font-bold text-sm hover:bg-[#0f66bd]">
                        Open SOP
                    </button>
                </Card>
            )}
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400 flex items-center justify-center p-6">
            <div className="w-full max-w-2xl">{children}</div>
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-6 sm:p-8">{children}</div>;
}

function Header({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle: string }) {
    return (
        <div>
            <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600 mb-3">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
            <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</span>
            {children}
        </label>
    );
}

function ErrorBanner({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p role="alert" className="flex gap-2 mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" /> {message}
        </p>
    );
}

function PrivacyNote() {
    return (
        <p className="flex gap-2 mt-5 text-xs text-gray-500">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span>The recording is analysed by Google Gemini and deleted from it afterwards; Klaro doesn't keep the video. Screenshots of each step are saved with the SOP. Close anything private (passwords, client data) before recording.</span>
        </p>
    );
}
