import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { voiceEngine } from '../lib/voice';
import { AIInterviewer } from '../lib/ai/interviewer';
import { Mic, Square, Play, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SessionStatus = 'idle' | 'speaking' | 'listening' | 'processing';

export default function DriveMode() {
    const {
        selectedLanguage,
        selectedIndustry,
        selectedCountry,
        profile,
        addMessage,
        setIsRecording
    } = useStore();

    const [status, setStatus] = useState<SessionStatus>('idle');
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [currentAIResponse, setCurrentAIResponse] = useState('');
    const [showGenerateButton, setShowGenerateButton] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    // Logic refs
    const aiInterviewer = useRef<AIInterviewer | null>(null);
    const isSessionActive = useRef(false);

    useEffect(() => {
        aiInterviewer.current = new AIInterviewer(selectedLanguage, selectedIndustry, selectedCountry, profile?.agentic_prompt);

        // Preload voices
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }

        return () => {
            // Cleanup on unmount
            handleStopSession();
        };
    }, [selectedLanguage]);

    const handleStartSession = async () => {
        if (isSessionActive.current) return;

        isSessionActive.current = true;
        setStatus('speaking');

        // 1. Initial Greeting
        const greeting = {
            en: "Drive mode on. I'm listening. What process shall we document today?",
            es: "Modo de conducción activado. Te escucho. ¿Qué proceso documentaremos hoy?",
            nl: "Rijmodus aan. Ik luister. Welk proces zullen we vandaag documenteren?",
            fr: "Mode conduite activé. Je vous écoute. Quel processus allons-nous documenter aujourd'hui?",
            de: "Fahrmodus ein. Ich höre zu. Welchen Prozess sollen wir heute dokumentieren?",
            it: "Modalità guida attiva. Ti ascolto. Quale processo documenteremo oggi?",
            pt: "Modo de direção ativado. Estou ouvindo. Qual processo devemos documentar hoje?",
            pl: "Tryb jazdy włączony. Słucham. Jaki proces dziś udokumentujemy?"
        }[selectedLanguage] || "Drive mode on. What process shall we document?";

        setCurrentAIResponse(greeting);
        addMessage({ role: 'ai', content: greeting });

        try {
            // Speak Greeting
            await voiceEngine.speak(greeting, selectedLanguage);

            // Start Loop
            if (isSessionActive.current) {
                startListeningLoop();
            }
        } catch (error) {
            console.error("Greeting failed:", error);
            if (isSessionActive.current) startListeningLoop();
        }
    };

    const handleGenerateSOP = async () => {
        setIsGenerating(true);
        handleStopSession();
        try {
            const { user, team } = useStore.getState();
            if (!user || !team) throw new Error('Not authenticated');

            const firstUserMessage = useStore.getState().interviewMessages.find(m => m.role === 'user')?.content || 'Untitled SOP';
            const title = firstUserMessage.length > 50 ? firstUserMessage.substring(0, 50) + '...' : firstUserMessage;

            const content = await aiInterviewer.current!.generateSOP(title);
            const metadata = await aiInterviewer.current!.extractMetadata(title);

            const { error } = await supabase!
                .from('sops')
                .insert({
                    team_id: team.id,
                    title: title,
                    content: content,
                    language: selectedLanguage,
                    tags: metadata.tags || [],
                    version: 1,
                    created_by: user.id
                });

            if (error) throw error;

            setIsComplete(true);
            setCurrentAIResponse("🎉 Your SOP has been generated! You can now return to the dashboard.");
            voiceEngine.speak("Your SOP has been generated. You can now return to the dashboard.", selectedLanguage);
        } catch (error) {
            console.error('SOP generation error:', error);
            alert('Failed to generate SOP.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStopSession = () => {
        isSessionActive.current = false;
        voiceEngine.stopSpeaking();
        voiceEngine.stopRecording(); // This cleans up VAD too
        setIsRecording(false);
        setStatus('idle');
    };

    const startListeningLoop = async () => {
        if (!isSessionActive.current) return;

        setStatus('listening');
        setIsRecording(true);
        setCurrentTranscript('');

        try {
            await voiceEngine.startRecording({
                onSilence: () => {
                    // Silence detected! Stop and process.
                    completeTurn();
                }
            });
        } catch (error) {
            console.error("Start listening failed:", error);
            alert("Could not start microphone. Please check permissions.");
            handleStopSession();
        }
    };

    const completeTurn = async () => {
        if (!isSessionActive.current) return;

        setStatus('processing');
        setIsRecording(false); // UI update

        try {
            // 1. Stop Recording & Get Audio
            const audioBlob = await voiceEngine.stopRecording();

            // 2. Transcribe
            const { text } = await voiceEngine.transcribe(audioBlob, selectedLanguage);

            if (!text.trim()) {
                // If silence/empty, usually we ask clarification or just listen again?
                // Let's listen again to be non-intrusive.
                if (isSessionActive.current) startListeningLoop();
                return;
            }

            setCurrentTranscript(text);
            addMessage({ role: 'user', content: text });

            // 3. Get AI Response
            const response = await aiInterviewer.current?.getResponse(text) || "I didn't catch that.";
            setCurrentAIResponse(response);
            addMessage({ role: 'ai', content: response });

            // 4. Speak Response
            setStatus('speaking');

            // Check for readiness in AI response
            const readinessPhrases = ["ready to generate", "all the information I need", "generate the SOP now"];
            if (readinessPhrases.some(p => response.toLowerCase().includes(p))) {
                setShowGenerateButton(true);
            }

            await voiceEngine.speak(response, selectedLanguage);

            // 5. Loop back to listening
            if (isSessionActive.current && !showGenerateButton) {
                startListeningLoop();
            }

        } catch (error) {
            console.error("Turn processing failed:", error);
            if (isSessionActive.current) startListeningLoop();
        }
    };

    // Manual override if VAD fails
    const forceStopRecording = () => {
        if (status === 'listening') {
            completeTurn();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-between p-6 safe-area-top safe-area-bottom">
            {/* Header */}
            <div className="w-full max-w-md sticky top-0 bg-gray-50 pt-2 pb-4 z-10">
                <div className="bg-white shadow-sm rounded-lg p-4 text-center border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">
                        {status === 'idle' ? 'Drive Mode' : isComplete ? 'SOP Generated' : 'Session Active'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {status === 'idle' ? 'Hands-free voice documentation' : isComplete ? 'Success' : 'Tap Stop to end session'}
                    </p>
                </div>
            </div>

            {/* Floating Generate Button */}
            {showGenerateButton && !isComplete && (
                <div className="fixed top-24 left-0 right-0 z-20 flex justify-center animate-bounce">
                    <button
                        onClick={handleGenerateSOP}
                        disabled={isGenerating}
                        className="btn-primary py-4 px-8 rounded-2xl shadow-2xl shadow-primary/40 text-lg font-bold scale-110"
                    >
                        {isGenerating ? 'Generating SOP...' : 'Generate SOP Now'}
                    </button>
                </div>
            )}

            {/* Content Area */}
            <div className="w-full max-w-2xl flex-1 flex flex-col justify-center space-y-6">
                {status === 'idle' ? (
                    <div className="text-center text-gray-400">
                        <p>Tap the microphone to start.</p>
                        <p className="text-sm mt-2">I will listen automatically when you speak.</p>
                    </div>
                ) : (
                    <>
                        {/* Status Indicator */}
                        <div className="text-center">
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-300 ${status === 'listening' ? 'bg-red-100 text-red-700' :
                                status === 'speaking' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                {status === 'listening' && <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />}
                                {status === 'speaking' && <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />}
                                {status === 'processing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                {status === 'listening' ? 'Listening...' :
                                    status === 'speaking' ? 'Klaro Speaking...' :
                                        'Thinking...'}
                            </span>
                        </div>

                        {/* Transcript Cards */}
                        {currentTranscript && (
                            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">You Said:</p>
                                <p className="text-gray-800 text-xl font-medium leading-relaxed">{currentTranscript}</p>
                            </div>
                        )}

                        {currentAIResponse && (
                            <div className={`bg-blue-50 rounded-xl p-6 shadow-md border border-blue-100 transition-opacity duration-500 ${status === 'speaking' ? 'opacity-100' : 'opacity-75'}`}>
                                <p className="text-xs font-semibold text-blue-400 mb-2 uppercase">Klaro:</p>
                                <p className="text-gray-800 text-xl font-medium leading-relaxed">{currentAIResponse}</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-6 pb-8 pt-4">
                {isComplete ? (
                    <button
                        onClick={() => window.location.href = '/'}
                        className="btn-primary w-64 py-5 rounded-2xl text-xl font-bold font-heading shadow-xl"
                    >
                        Return to Dashboard
                    </button>
                ) : status === 'idle' ? (
                    <button
                        onClick={handleStartSession}
                        className="w-24 h-24 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ring-4 ring-blue-100"
                    >
                        <Play className="w-10 h-10 text-white ml-1" />
                    </button>
                ) : (
                    <div className="flex items-center gap-8">
                        {status === 'listening' && (
                            <button
                                onClick={forceStopRecording}
                                className="w-16 h-16 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                                title="Force Send"
                            >
                                <Mic className="w-8 h-8" />
                            </button>
                        )}

                        <button
                            onClick={handleStopSession}
                            className="w-24 h-24 rounded-full bg-gray-800 hover:bg-gray-900 shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ring-4 ring-gray-200"
                        >
                            <Square className="w-8 h-8 text-white fill-current" />
                        </button>
                    </div>
                )}

                <div className="text-center pb-safe">
                    <p className="text-gray-900 font-semibold text-lg">
                        {status === 'idle' ? 'Start Session' : status === 'listening' ? 'Listening...' : status === 'speaking' ? 'Speaking...' : 'Processing'}
                    </p>
                    <p className="text-gray-500 text-sm">
                        {status === 'idle' ? 'Tap to begin hands-free mode' : 'Tap Square to stop session'}
                    </p>
                </div>
            </div>
        </div>
    );
}
