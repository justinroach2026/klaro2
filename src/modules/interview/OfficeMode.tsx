import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../../store';
import { voiceEngine } from '../../lib/voice';
import { AIInterviewer } from '../../lib/ai/interviewer';
import { supabase, createInterviewSession, saveInterviewTranscript, completeInterviewSession, loadInterviewSession } from '../../lib/supabase';
import { Mic, Send, ArrowLeft } from 'lucide-react';

export default function OfficeMode() {
    const navigate = useNavigate();
    const {
        selectedLanguage,
        selectedIndustry,
        selectedCountry,
        profile,
        isRecording,
        addMessage,
        interviewMessages,
        setIsRecording,
        user,
        team,
        sessionId,
        setSessionId,
        clearMessages,
    } = useStore();

    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showGenerateButton, setShowGenerateButton] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isRestoringSession, setIsRestoringSession] = useState(true);

    const aiInterviewer = useRef(new AIInterviewer(selectedLanguage, selectedIndustry, selectedCountry, profile?.agentic_prompt));
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef<string | null>(sessionId);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    }, [interviewMessages, isProcessing]);

    // Restore in-progress session on mount
    useEffect(() => {
        const restore = async () => {
            if (!user) { setIsRestoringSession(false); return; }
            try {
                const existing = await loadInterviewSession(user.id, 'office');
                if (existing && existing.transcript?.length > 0) {
                    clearMessages();
                    existing.transcript.forEach((m: any) => addMessage({ role: m.role, content: m.content }));
                    // Replay history into the AI so it has full context
                    aiInterviewer.current.loadHistory(existing.transcript);
                    sessionIdRef.current = existing.id;
                    setSessionId(existing.id);
                }
            } catch (err) {
                console.error('Failed to restore session:', err);
            } finally {
                setIsRestoringSession(false);
            }
        };
        restore();
    }, [user]);

    // Auto-save transcript whenever messages change
    useEffect(() => {
        if (isRestoringSession || interviewMessages.length === 0) return;
        const save = async () => {
            try {
                if (!sessionIdRef.current) {
                    const teamId = team?.id || profile?.team_id;
                    if (!user || !teamId) return;
                    const id = await createInterviewSession(teamId, user.id, 'office', selectedLanguage);
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

    useEffect(() => {
        const greet = async () => {
            const greeting = {
                en: "Hello! I'm here to help you document your business process. What process would you like to create an SOP for today?",
                es: "¡Hola! Estoy aquí para ayudarte a documentar tu proceso comercial. ¿Para qué proceso te gustaría crear un POE hoy?",
                nl: "Hallo! Ik ben hier om je te helpen je bedrijfsproces te documenteren. Voor welk proces wil je vandaag een SOP maken?",
                fr: "Bonjour! Je suis là pour vous aider à documenter votre processus commercial. Pour quel processus souhaitez-vous créer une POS aujourd'hui?",
                de: "Hallo! Ich bin hier, um Ihnen bei der Dokumentation Ihres Geschäftsprozesses zu helfen. Für welchen Prozess möchten Sie heute eine SOP erstellen?",
                it: "Ciao! Sono qui per aiutarti a documentare il tuo processo aziendale. Per quale processo vorresti creare una SOP oggi?",
                pt: "Olá! Estou aqui para ajudá-lo a documentar seu processo de negócios. Para qual processo você gostaria de criar um POP hoje?",
                pl: "Cześć! Jestem tutaj, aby pomóc Ci udokumentować Twój proces biznesowy. Dla jakiego procesu chciałbyś stworzyć SOP dzisiaj?",
            }[selectedLanguage];

            if (greeting) addMessage({ role: 'ai', content: greeting });
        };

        if (interviewMessages.length === 0 && !isRestoringSession) greet();
    }, [selectedLanguage]);

    useEffect(() => {
        const lastMessage = interviewMessages[interviewMessages.length - 1];
        if (lastMessage?.role === 'ai') {
            const readinessPhrases = [
                "I have all the information I need",
                "ready to generate the SOP",
                "Would you like me to generate the SOP now?",
                "Tengo toda la información que necesito",
                "Ik heb alle informatie die ik nodig heb",
                "J'ai toutes les informations dont j'ai besoin",
                "Ich habe alle Informationen, die ich brauche",
                "Ho tutte le informazioni di cui ho bisogno",
                "Tenho todas as informazioni que preciso",
                "Mam wszystkie potrzebne informacje",
                "Please click the 'Generate SOP Now' button",
                "Please click the \"Generate SOP Now\" button"
            ];

            const isReady = readinessPhrases.some(phrase =>
                lastMessage.content.toLowerCase().includes(phrase.toLowerCase())
            );
            setShowGenerateButton(isReady);
        }
    }, [interviewMessages]);

    const handleSendText = async () => {
        if (!inputText.trim() || isProcessing) return;

        const text = inputText.trim();
        setInputText('');
        setIsProcessing(true);
        setTimeout(() => {
            const el = document.getElementById('chat-input');
            if (el) el.style.height = 'auto';
        }, 10);

        try {
            addMessage({ role: 'user', content: text });
            const aiResponse = await aiInterviewer.current.getResponse(text);
            addMessage({ role: 'ai', content: aiResponse });
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGenerateSOP = async () => {
        setIsGenerating(true);
        try {
            const { user, team, profile } = useStore.getState();
            if (!user || (!team && !profile?.team_id)) throw new Error('Not authenticated - Missing Team/User Data');
            const teamId = team?.id || profile?.team_id;

            const firstUserMessage = interviewMessages.find(m => m.role === 'user')?.content || 'Untitled SOP';
            const title = firstUserMessage.length > 50 ? firstUserMessage.substring(0, 50) + '...' : firstUserMessage;

            const authorInfo = `
Author: ${profile?.full_name || user.email || 'Author'}
Company: ${profile?.company_name || team?.name || 'Company'}
${profile?.company_website ? `Website: ${profile.company_website}` : ''}
${profile?.company_address ? `Location: ${profile.company_address}` : ''}
            `.trim();

            const content = await aiInterviewer.current.generateSOP(title, authorInfo);
            const metadata = await aiInterviewer.current.extractMetadata(title);

            const { error } = await supabase!
                .from('sops')
                .insert({
                    team_id: teamId,
                    title: title,
                    content: content,
                    language: selectedLanguage,
                    tags: metadata.tags || [],
                    version: 1,
                    created_by: user.id
                });

            if (error) throw error;

            if (sessionIdRef.current) {
                await completeInterviewSession(sessionIdRef.current, undefined);
                sessionIdRef.current = null;
                setSessionId(null);
            }

            setIsComplete(true);
            addMessage({ role: 'ai', content: "🎉 Your SOP has been generated and saved! You can now view it in your dashboard." });
        } catch (error) {
            console.error('SOP generation error:', error);
            alert('Failed to generate SOP. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleVoiceInput = async () => {
        if (isRecording) {
            try {
                const audioBlob = await voiceEngine.stopRecording();
                setIsRecording(false);
                setIsProcessing(true);

                const { text } = await voiceEngine.transcribe(audioBlob, selectedLanguage);
                addMessage({ role: 'user', content: text });

                const aiResponse = await aiInterviewer.current.getResponse(text);
                addMessage({ role: 'ai', content: aiResponse });

                setIsProcessing(false);
            } catch (error) {
                console.error('Voice error:', error);
                setIsRecording(false);
                setIsProcessing(false);
            }
        } else {
            try {
                await voiceEngine.startRecording();
                setIsRecording(true);
            } catch (error) {
                console.error('Recording error:', error);
                alert('Failed to start recording. Please check microphone permissions.');
            }
        }
    };

    return (
        <div className="h-screen bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400 dark:bg-none dark:bg-[#09090b] flex flex-col overflow-hidden">
            <div className="bg-white/90 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-white/20 dark:border-white/5 p-4 safe-area-top">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors flex-shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Office Mode</h2>
                        <p className="text-sm text-gray-500 dark:text-white/40">Chat-based documentation</p>
                    </div>
                    {showGenerateButton && (
                        <button
                            onClick={handleGenerateSOP}
                            disabled={isGenerating}
                            className="px-6 py-2 bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold rounded-xl animate-bounce shadow-lg shadow-[#137fec]/30 transition-all disabled:opacity-50"
                        >
                            {isGenerating ? 'Generating...' : 'Generate SOP Now'}
                        </button>
                    )}
                </div>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {interviewMessages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`rounded-2xl px-4 py-3 max-w-[80%] break-words ${
                                message.role === 'user'
                                    ? 'bg-[#137fec] text-white ml-auto'
                                    : 'bg-white dark:bg-white/5 border border-white/30 dark:border-white/8 text-gray-800 dark:text-white/80 mr-auto shadow-sm'
                            }`}>
                                {message.role === 'ai' ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:mb-2 prose-p:last:mb-0 prose-ul:list-disc prose-ol:list-decimal prose-ul:ml-5 prose-ol:ml-5 prose-li:pl-1">
                                        <ReactMarkdown>{message.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <p>{message.content}</p>
                                )}
                                <span className="text-xs text-gray-400 dark:text-white/50 mt-1 block">
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl px-4 py-3 bg-white dark:bg-white/5 border border-white/30 dark:border-white/8 mr-auto shadow-sm">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-white/30 rounded-full animate-pulse"></span>
                                    <span className="w-2 h-2 bg-white/30 rounded-full animate-pulse delay-75"></span>
                                    <span className="w-2 h-2 bg-white/30 rounded-full animate-pulse delay-150"></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="bg-white/90 dark:bg-[#09090b]/80 backdrop-blur-xl border-t border-white/20 dark:border-white/5 p-4 safe-area-bottom">
                {isComplete ? (
                    <div className="max-w-4xl mx-auto flex flex-col items-center py-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full max-w-sm py-4 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold transition-all flex items-center justify-center gap-2"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto flex items-center gap-2">
                        <button
                            onClick={handleVoiceInput}
                            className={`p-3 rounded-xl transition-colors flex-shrink-0 ${isRecording
                                ? 'bg-red-500 text-white'
                                : 'bg-[#137fec]/10 hover:bg-[#137fec]/20 border border-[#137fec]/40 text-[#137fec] hover:border-[#137fec]'
                                }`}
                            disabled={isProcessing || isGenerating}
                        >
                            {isRecording ? <Mic className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <textarea
                            id="chat-input"
                            value={inputText}
                            onChange={(e) => {
                                setInputText(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendText();
                                }
                            }}
                            placeholder="Type your message... (Shift+Enter for new line)"
                            className="flex-1 resize-none overflow-y-auto min-h-[96px] max-h-48 py-2.5 px-4 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[#137fec]/50 focus:border-[#137fec] dark:focus:border-[#137fec]/30 transition-all"
                            rows={4}
                            disabled={isProcessing || isRecording || isGenerating}
                        />

                        <button
                            onClick={handleSendText}
                            className="p-3 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white transition-all disabled:opacity-30 flex-shrink-0"
                            disabled={!inputText.trim() || isProcessing || isRecording || isGenerating}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
