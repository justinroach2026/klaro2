import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, messageText } from '../../store';
import { voiceEngine } from '../../lib/voice';
import { AIInterviewer } from '../../lib/ai/interviewer';
import { getStarterQuestions } from '../../lib/templates';
import { Mic, Square, Play, RefreshCw, ArrowLeft, Briefcase } from 'lucide-react';
import { supabase, createInterviewSession, saveInterviewTranscript, completeInterviewSession, loadInterviewSession, updateInterviewSessionMode } from '../../lib/supabase';

type SessionStatus = 'idle' | 'speaking' | 'listening' | 'processing';

export default function DriveMode() {
    const navigate = useNavigate();
    const {
        selectedLanguage,
        selectedIndustry,
        selectedCountry,
        profile,
        addMessage,
        setIsRecording,
        user,
        team,
        sessionId,
        setSessionId,
        interviewMessages,
        selectedSOPTemplate,
        setInterviewMode,
    } = useStore();

    const sessionIdRef = useRef<string | null>(sessionId);

    const [status, setStatus] = useState<SessionStatus>('idle');
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [currentAIResponse, setCurrentAIResponse] = useState('');
    const [showGenerateButton, setShowGenerateButton] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    const aiInterviewer = useRef<AIInterviewer | null>(null);
    const isSessionActive = useRef(false);

    useEffect(() => {
        const store = useStore.getState();
        aiInterviewer.current = new AIInterviewer(
            selectedLanguage,
            selectedIndustry,
            selectedCountry,
            profile?.agentic_prompt,
            getStarterQuestions(store.selectedSOPTemplate, selectedIndustry)
        );

        if (store.interviewMessages.length > 0) {
            // In-app mode switch: replay the live conversation so context carries over
            aiInterviewer.current.loadHistory(
                store.interviewMessages.map(m => ({ role: m.role, content: messageText(m.content) }))
            );
        } else if (user) {
            // Fresh mount (e.g. page refresh): resume the most recent in-progress session
            const restore = async () => {
                try {
                    const existing = await loadInterviewSession(user.id);
                    if (existing && existing.transcript?.length > 0) {
                        existing.transcript.forEach((m) => addMessage({ role: m.role as 'user' | 'ai', content: m.content }));
                        aiInterviewer.current?.loadHistory(existing.transcript);
                        sessionIdRef.current = existing.id;
                        setSessionId(existing.id);
                        if (existing.mode !== 'drive') {
                            await updateInterviewSessionMode(existing.id, 'drive');
                        }
                    }
                } catch (err) {
                    console.error('Failed to restore session:', err);
                }
            };
            restore();
        }

        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }

        return () => {
            handleStopSession();
        };
    }, [selectedLanguage]);

    // Auto-save transcript whenever messages change
    useEffect(() => {
        if (interviewMessages.length === 0) return;
        const save = async () => {
            try {
                if (!sessionIdRef.current) {
                    const teamId = team?.id || profile?.team_id;
                    if (!user || !teamId) return;
                    const id = await createInterviewSession(teamId, user.id, 'drive', selectedLanguage);
                    sessionIdRef.current = id;
                    setSessionId(id);
                }
                await saveInterviewTranscript(sessionIdRef.current, interviewMessages);
            } catch (err) {
                console.error('Auto-save failed:', err);
            }
        };
        save();
    }, [interviewMessages]);

    const handleStartSession = async () => {
        if (isSessionActive.current) return;

        isSessionActive.current = true;
        setStatus('speaking');

        const hasHistory = useStore.getState().interviewMessages.length > 0;
        const templateTitle = selectedSOPTemplate?.title;

        // Pick the greeting: resuming a conversation, starting from a template
        // (the AI then guides with the template's starter questions), or fresh
        const greeting = (hasHistory
            ? {
                en: "Drive mode on. Let's continue where we left off — go ahead.",
                es: "Modo de conducción activado. Continuemos donde lo dejamos: adelante.",
                nl: "Rijmodus aan. Laten we verdergaan waar we gebleven waren — ga je gang.",
                fr: "Mode conduite activé. Reprenons là où nous nous étions arrêtés — allez-y.",
                de: "Fahrmodus ein. Machen wir dort weiter, wo wir aufgehört haben — leg los.",
                it: "Modalità guida attiva. Continuiamo da dove eravamo rimasti — vai pure.",
                pt: "Modo de direção ativado. Vamos continuar de onde paramos — pode falar.",
                pl: "Tryb jazdy włączony. Kontynuujmy od miejsca, w którym skończyliśmy — śmiało."
            }
            : templateTitle
                ? {
                    en: `Drive mode on. We're documenting "${templateTitle}". I'll guide you with a few questions — first, tell me how this process starts in your business.`,
                    es: `Modo de conducción activado. Vamos a documentar "${templateTitle}". Te guiaré con algunas preguntas: primero, cuéntame cómo empieza este proceso en tu negocio.`,
                    nl: `Rijmodus aan. We documenteren "${templateTitle}". Ik begeleid je met een paar vragen — vertel me eerst hoe dit proces in jouw bedrijf begint.`,
                    fr: `Mode conduite activé. Nous documentons « ${templateTitle} ». Je vais vous guider avec quelques questions — d'abord, dites-moi comment ce processus commence dans votre entreprise.`,
                    de: `Fahrmodus ein. Wir dokumentieren „${templateTitle}". Ich führe dich mit ein paar Fragen — erzähl mir zuerst, wie dieser Prozess in deinem Unternehmen beginnt.`,
                    it: `Modalità guida attiva. Stiamo documentando "${templateTitle}". Ti guiderò con alcune domande — prima, dimmi come inizia questo processo nella tua azienda.`,
                    pt: `Modo de direção ativado. Vamos documentar "${templateTitle}". Vou orientá-lo com algumas perguntas — primeiro, conte-me como esse processo começa no seu negócio.`,
                    pl: `Tryb jazdy włączony. Dokumentujemy „${templateTitle}". Poprowadzę Cię kilkoma pytaniami — najpierw powiedz mi, jak ten proces zaczyna się w Twojej firmie.`
                }
                : {
                    en: "Drive mode on. I'm listening. What process shall we document today?",
                    es: "Modo de conducción activado. Te escucho. ¿Qué proceso documentaremos hoy?",
                    nl: "Rijmodus aan. Ik luister. Welk proces zullen we vandaag documenteren?",
                    fr: "Mode conduite activé. Je vous écoute. Quel processus allons-nous documenter aujourd'hui?",
                    de: "Fahrmodus ein. Ich höre zu. Welchen Prozess sollen wir heute dokumentieren?",
                    it: "Modalità guida attiva. Ti ascolto. Quale processo documenteremo oggi?",
                    pt: "Modo de direção ativado. Estou ouvindo. Qual processo devemos documentar hoje?",
                    pl: "Tryb jazdy włączony. Słucham. Jaki proces dziś udokumentujemy?"
                }
        )[selectedLanguage] || "Drive mode on. What process shall we document?";

        setCurrentAIResponse(greeting);
        addMessage({ role: 'ai', content: greeting });

        try {
            await voiceEngine.speak(greeting, selectedLanguage);
            if (isSessionActive.current) startListeningLoop();
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

            const firstUserContent = useStore.getState().interviewMessages.find(m => m.role === 'user')?.content;
            const firstUserMessage = (firstUserContent ? messageText(firstUserContent) : '') || 'Untitled SOP';
            const title = firstUserMessage.length > 50 ? firstUserMessage.substring(0, 50) + '...' : firstUserMessage;

            // Prefer the live draft document (built in Office Mode) when it exists
            const liveDraft = useStore.getState().sopContent;
            const content = liveDraft || await aiInterviewer.current!.generateSOP(title);
            const metadata = await aiInterviewer.current!.extractMetadata(title);

            // Publish the autosaved draft in place when one exists (e.g. after a
            // switch from Office Mode), otherwise insert a new SOP
            const currentDraftId = useStore.getState().draftSOPId;
            if (currentDraftId) {
                const { error } = await supabase!
                    .from('sops')
                    .update({
                        title: title,
                        content: content,
                        tags: metadata.tags || [],
                        status: 'published',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentDraftId);
                if (error) throw error;
            } else {
                const { error } = await supabase!
                    .from('sops')
                    .insert({
                        team_id: team.id,
                        title: title,
                        content: content,
                        language: selectedLanguage,
                        tags: metadata.tags || [],
                        version: 1,
                        created_by: user.id,
                        status: 'published'
                    });
                if (error) throw error;
            }

            if (sessionIdRef.current) {
                await completeInterviewSession(sessionIdRef.current, currentDraftId ?? undefined);
                sessionIdRef.current = null;
                setSessionId(null);
            }
            const store = useStore.getState();
            store.setDraftSOPId(null);
            store.setAutosaveStatus('idle');
            store.setSelectedSOPTemplate(null);
            store.setSopContent('');
            store.setSopHistory([]);

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
        voiceEngine.stopRecording();
        setIsRecording(false);
        setStatus('idle');
    };

    const handleSwitchToOffice = async () => {
        handleStopSession();
        try {
            if (sessionIdRef.current) await updateInterviewSessionMode(sessionIdRef.current, 'office');
        } catch (err) {
            console.error('Failed to persist mode switch:', err);
        }
        setInterviewMode('office');
    };

    const startListeningLoop = async () => {
        if (!isSessionActive.current) return;

        setStatus('listening');
        setIsRecording(true);
        setCurrentTranscript('');

        try {
            await voiceEngine.startRecording({
                onSilence: () => { completeTurn(); }
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
        setIsRecording(false);

        try {
            const audioBlob = await voiceEngine.stopRecording();
            const { text } = await voiceEngine.transcribe(audioBlob, selectedLanguage);

            if (!text.trim()) {
                if (isSessionActive.current) startListeningLoop();
                return;
            }

            setCurrentTranscript(text);
            addMessage({ role: 'user', content: text });

            const response = await aiInterviewer.current?.getResponse(text) || "I didn't catch that.";
            setCurrentAIResponse(response);
            addMessage({ role: 'ai', content: response });

            setStatus('speaking');

            const readinessPhrases = ["ready to generate", "all the information I need", "generate the SOP now"];
            if (readinessPhrases.some(p => response.toLowerCase().includes(p))) {
                setShowGenerateButton(true);
            }

            await voiceEngine.speak(response, selectedLanguage);

            if (isSessionActive.current && !showGenerateButton) {
                startListeningLoop();
            }

        } catch (error) {
            console.error("Turn processing failed:", error);
            if (isSessionActive.current) startListeningLoop();
        }
    };

    const forceStopRecording = () => {
        if (status === 'listening') completeTurn();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400 dark:bg-none dark:bg-[#09090b] flex flex-col items-center justify-between p-6 safe-area-top safe-area-bottom">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-[#137fec]/6 rounded-full blur-[140px]" />
            </div>

            <div className="relative w-full max-w-md sticky top-0 pt-2 pb-4 z-10">
                <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl border border-white/30 dark:border-white/8 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { handleStopSession(); navigate('/dashboard'); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors flex-shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">Back</span>
                        </button>
                        <div className="flex-1 text-center">
                            <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                                {status === 'idle' ? 'Drive Mode' : isComplete ? 'SOP Generated' : 'Session Active'}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
                                {status === 'idle' ? 'Hands-free voice documentation' : isComplete ? 'Success' : 'Tap Stop to end session'}
                            </p>
                        </div>
                        {!isComplete ? (
                            <button
                                onClick={handleSwitchToOffice}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors flex-shrink-0"
                                title="Continue this session typing in Office Mode"
                            >
                                <Briefcase className="w-4 h-4" />
                                <span className="text-sm font-medium hidden sm:inline">Office</span>
                            </button>
                        ) : (
                            <div className="w-16 flex-shrink-0" />
                        )}
                    </div>
                </div>
            </div>

            {showGenerateButton && !isComplete && (
                <div className="fixed top-24 left-0 right-0 z-20 flex justify-center animate-bounce">
                    <button
                        onClick={handleGenerateSOP}
                        disabled={isGenerating}
                        className="px-8 py-4 rounded-2xl bg-[#137fec] hover:bg-[#0f66bd] text-white text-lg font-black shadow-2xl shadow-[#137fec]/40 transition-all disabled:opacity-50"
                    >
                        {isGenerating ? 'Generating SOP...' : 'Generate SOP Now'}
                    </button>
                </div>
            )}

            <div className="relative w-full max-w-2xl flex-1 flex flex-col justify-center space-y-6">
                {status === 'idle' ? (
                    <div className="text-center text-white/30">
                        <p className="text-lg font-medium">Tap the microphone to start.</p>
                        <p className="text-sm mt-2">I will listen automatically when you speak.</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center">
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${
                                status === 'listening' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                                status === 'speaking' ? 'bg-[#137fec]/15 text-[#137fec] border border-[#137fec]/20' :
                                'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            }`}>
                                {status === 'listening' && <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
                                {status === 'speaking' && <div className="w-2 h-2 rounded-full bg-[#137fec] animate-bounce" />}
                                {status === 'processing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                {status === 'listening' ? 'Listening...' : status === 'speaking' ? 'Klaro Speaking...' : 'Thinking...'}
                            </span>
                        </div>

                        {currentTranscript && (
                            <div className="bg-white dark:bg-white/5 border border-white/30 dark:border-white/8 rounded-2xl p-6 shadow-sm">
                                <p className="text-[10px] font-black text-gray-400 dark:text-white/30 mb-2 uppercase tracking-widest">You Said:</p>
                                <p className="text-gray-900 dark:text-white text-xl font-medium leading-relaxed">{currentTranscript}</p>
                            </div>
                        )}

                        {currentAIResponse && (
                            <div className={`bg-white dark:bg-[#137fec]/8 border border-[#137fec]/20 dark:border-[#137fec]/15 rounded-2xl p-6 shadow-sm transition-opacity duration-500 ${status === 'speaking' ? 'opacity-100' : 'opacity-60'}`}>
                                <p className="text-[10px] font-black text-[#137fec] mb-2 uppercase tracking-widest">Klaro:</p>
                                <p className="text-gray-900 dark:text-white text-xl font-medium leading-relaxed">{currentAIResponse}</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="relative flex flex-col items-center gap-6 pb-8 pt-4">
                {isComplete ? (
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-64 py-5 rounded-2xl bg-[#137fec] hover:bg-[#0f66bd] text-white text-xl font-black shadow-xl shadow-[#137fec]/20 transition-all"
                    >
                        Return to Dashboard
                    </button>
                ) : status === 'idle' ? (
                    <button
                        onClick={handleStartSession}
                        className="w-24 h-24 rounded-full bg-[#137fec] hover:bg-[#0f66bd] shadow-2xl shadow-[#137fec]/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-4 ring-[#137fec]/20"
                    >
                        <Play className="w-10 h-10 text-white ml-1" />
                    </button>
                ) : (
                    <div className="flex items-center gap-8">
                        {status === 'listening' && (
                            <button
                                onClick={forceStopRecording}
                                className="w-16 h-16 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 flex items-center justify-center transition-all"
                                title="Force Send"
                            >
                                <Mic className="w-8 h-8" />
                            </button>
                        )}

                        <button
                            onClick={handleStopSession}
                            className="w-24 h-24 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                        >
                            <Square className="w-8 h-8 text-white fill-current" />
                        </button>
                    </div>
                )}

                <div className="text-center pb-safe">
                    <p className="text-white font-bold text-lg">
                        {status === 'idle' ? 'Start Session' : status === 'listening' ? 'Listening...' : status === 'speaking' ? 'Speaking...' : 'Processing'}
                    </p>
                    <p className="text-white/30 text-sm mt-1">
                        {status === 'idle' ? 'Tap to begin hands-free mode' : 'Tap Square to stop session'}
                    </p>
                </div>
            </div>
        </div>
    );
}
