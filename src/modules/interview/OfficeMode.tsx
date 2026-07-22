import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useStore, messageText } from '../../store';
import { voiceEngine } from '../../lib/voice';
import { AIInterviewer } from '../../lib/ai/interviewer';
import { supabase, createInterviewSession, saveInterviewTranscript, completeInterviewSession, loadInterviewSession } from '../../lib/supabase';
import { generateBestPracticeSOP } from '../../lib/ai/interviewer';
import { Mic, Send, ArrowLeft, Check, X, RotateCcw, FileText, Sparkles, ImagePlus } from 'lucide-react';

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
        sopContent,
        setSopContent,
        pendingUpdate,
        setPendingUpdate,
        sopHistory: history,
        setSopHistory: setHistory,
    } = useStore();

    const [inputText, setInputText] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showGenerateButton, setShowGenerateButton] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isRestoringSession, setIsRestoringSession] = useState(true);

    const [isResearching, setIsResearching] = useState(false);
    const { selectedSOPTemplate } = useStore();

    const aiInterviewer = useRef(new AIInterviewer(selectedLanguage, selectedIndustry, selectedCountry, profile?.agentic_prompt));
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef<string | null>(sessionId);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert('Currently only image/screenshot uploads are supported natively without additional plugins.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    setAttachments(prev => [...prev, reader.result as string]);
                }
            };
            reader.readAsDataURL(file);
        });

        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
    };

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

        if (interviewMessages.length === 0 && !isRestoringSession) {
            greet();

            // If a template is selected, research best practice and show it on the right
            if (selectedSOPTemplate) {
                const initSOP = async () => {
                    setIsResearching(true);
                    try {
                        const { content } = await generateBestPracticeSOP({
                            title: selectedSOPTemplate.title,
                            industry: selectedIndustry,
                            language: selectedLanguage,
                            country: selectedCountry,
                            agenticPrompt: profile?.agentic_prompt
                        });
                        if (!sopContent) {
                            setSopContent(content);
                            setHistory([content]);

                            // Initialize actual Draft in Database so it appears on Dashboard immediately
                            try {
                                const { user, team, profile: usrProfile } = useStore.getState();
                                const teamId = team?.id || usrProfile?.team_id;
                                if (user && teamId) {
                                    // Use the supabase instance to directly create the draft
                                    const { data, error } = await supabase!
                                        .from('sops')
                                        .insert({
                                            team_id: teamId,
                                            created_by: user.id,
                                            title: selectedSOPTemplate.title,
                                            content: content,
                                            tags: selectedSOPTemplate.tags || [],
                                            language: selectedLanguage,
                                            version: 1,
                                            status: 'draft',
                                            related_sop_ids: []
                                        })
                                        .select('id')
                                        .single();

                                    if (error) throw error;

                                    if (data?.id) {
                                        // We could save this draft ID, but for now just establishing the row 
                                        // ensures the user sees a Draft on their dashboard.
                                        console.log("Draft created successfully:", data.id);
                                    }
                                }
                            } catch (e) {
                                console.error('Silent failure creating immediate draft:', e);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to pre-fill best practice:', err);
                        setSopContent(selectedSOPTemplate.content || '');
                    } finally {
                        setIsResearching(false);
                    }
                };
                initSOP();
            }
        }
    }, [selectedLanguage, selectedSOPTemplate, isRestoringSession, interviewMessages.length]);

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

            const aiText = typeof lastMessage.content === 'string' ? lastMessage.content.toLowerCase() : '';
            
            // Check for exact phrases or just show it if there's enough history
            const isReady = readinessPhrases.some(phrase => aiText.includes(phrase.toLowerCase())) || 
                            aiText.includes('generate') || 
                            aiText.includes('sop') || 
                            interviewMessages.length >= 5;
                            
            setShowGenerateButton(isReady);
        }
    }, [interviewMessages]);

    const handleSendText = async () => {
        if ((!inputText.trim() && attachments.length === 0) || isProcessing) return;

        const text = inputText.trim() || "See attached media";
        const currentAttachments = [...attachments];

        setInputText('');
        setAttachments([]);
        setIsProcessing(true);
        setTimeout(() => {
            const el = document.getElementById('chat-input');
            if (el) el.style.height = 'auto';
        }, 10);

        try {
            addMessage({ role: 'user', content: text, attachments: currentAttachments });
            const result = await aiInterviewer.current.getResponseWithSuggestions(text, sopContent, currentAttachments);

            addMessage({ role: 'ai', content: result.chatResponse });

            if (result.suggestedSOPUpdate) {
                setPendingUpdate(result.suggestedSOPUpdate);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAcceptUpdate = () => {
        if (!pendingUpdate) return;
        setHistory(prev => [...prev, sopContent]);
        setSopContent(pendingUpdate);
        setPendingUpdate(null);
    };

    const handleRollback = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setSopContent(previous);
        setHistory(prev => prev.slice(0, -1));
        setPendingUpdate(null);
    };

    const handleRejectUpdate = () => {
        setPendingUpdate(null);
    };

    const handleGenerateSOP = async () => {
        setIsGenerating(true);
        try {
            const { user, team, profile } = useStore.getState();
            if (!user || (!team && !profile?.team_id)) throw new Error('Not authenticated - Missing Team/User Data');
            const teamId = team?.id || profile?.team_id;

            const firstUserMsgContent = interviewMessages.find(m => m.role === 'user')?.content;
            const extracted = firstUserMsgContent ? messageText(firstUserMsgContent) : '';
            const firstUserText = extracted
                || (Array.isArray(firstUserMsgContent) ? 'Attached Media SOP' : 'Untitled SOP');

            const title = firstUserText.length > 50 ? firstUserText.substring(0, 50) + '...' : firstUserText;

            // Use the live draft content we've been building
            const finalContent = sopContent || await aiInterviewer.current.generateSOP(title);
            const metadata = await aiInterviewer.current.extractMetadata(title);

            const { error } = await supabase!
                .from('sops')
                .insert({
                    team_id: teamId,
                    title: title,
                    content: finalContent,
                    language: selectedLanguage,
                    tags: metadata.tags || [],
                    version: 1,
                    created_by: user.id,
                    status: 'published',
                    related_sop_ids: []
                });

            if (error) throw error;

            if (sessionIdRef.current) {
                await completeInterviewSession(sessionIdRef.current, undefined);
                sessionIdRef.current = null;
                setSessionId(null);

                // Clear state when finished
                useStore.getState().setSelectedSOPTemplate(null);
                setSopContent('');
                setPendingUpdate(null);
                setHistory([]);
            }

            setIsComplete(true);
            addMessage({ role: 'ai', content: "🎉 Your SOP has been generated and saved! You can now view it in your dashboard." });
        } catch (error: any) {
            console.error('SOP generation error:', error);
            const msg = error?.message || error?.error_description || JSON.stringify(error) || 'Unknown error occurred.';
            alert('Failed to save SOP: ' + msg);
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
        <div className="h-screen bg-[#f8fafc] dark:bg-[#09090b] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 p-4 safe-area-top z-10">
                <div className="max-w-[1600px] mx-auto flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-colors flex-shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                            Office Mode
                            {selectedSOPTemplate && (
                                <span className="px-2 py-0.5 rounded-full bg-[#137fec]/10 text-[#137fec] text-[10px] font-bold uppercase tracking-wider">
                                    {selectedSOPTemplate.title}
                                </span>
                            )}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-white/40">Collaborative process documentation</p>
                    </div>
                    {showGenerateButton && (
                        <button
                            onClick={handleGenerateSOP}
                            disabled={isGenerating}
                            className="px-6 py-2 bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold rounded-xl shadow-lg shadow-[#137fec]/30 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Finalizing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 text-yellow-300" />
                                    Generate SOP Now
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area: Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Column: Chat */}
                <div className="w-full lg:w-1/2 flex flex-col border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#09090b]">
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-2xl mx-auto space-y-6">
                            {interviewMessages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`group relative rounded-2xl px-5 py-4 max-w-[90%] break-words ${message.role === 'user'
                                        ? 'bg-[#137fec] text-white ml-auto rounded-tr-none shadow-md shadow-[#137fec]/20'
                                        : 'bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/8 text-gray-800 dark:text-white/80 mr-auto rounded-tl-none shadow-sm'
                                        }`}>
                                        {message.role === 'ai' ? (
                                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:mb-2 prose-p:last:mb-0 prose-ul:list-disc prose-ol:list-decimal prose-ul:ml-5 prose-ol:ml-5 prose-li:pl-1">
                                                <ReactMarkdown>{messageText(message.content)}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                                {messageText(message.content) || 'Multi-part message'}
                                            </p>
                                        )}
                                        {message.attachments && message.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {message.attachments.map((att, i) => (
                                                    <img key={i} src={att} alt="Attachment" className="max-w-[200px] max-h-[200px] object-cover rounded-xl border border-white/20" />
                                                ))}
                                            </div>
                                        )}
                                        <span className={`text-[10px] mt-2 block opacity-40 uppercase font-bold tracking-widest ${message.role === 'user' ? 'text-white' : 'text-gray-400'}`}>
                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {isProcessing && (
                                <div className="flex justify-start">
                                    <div className="rounded-2xl px-5 py-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/8 mr-auto rounded-tl-none">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-[#137fec] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-1.5 h-1.5 bg-[#137fec] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-1.5 h-1.5 bg-[#137fec] rounded-full animate-bounce"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Chat Input */}
                    <div className="p-6 bg-white dark:bg-[#09090b] border-t border-gray-200 dark:border-white/5">
                        {isComplete ? (
                            <div className="max-w-2xl mx-auto flex flex-col items-center">
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="px-8 py-3 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#137fec]/20"
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        ) : (
                            <div className="max-w-2xl mx-auto flex flex-col gap-3">
                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-3 px-2">
                                        {attachments.map((att, index) => (
                                            <div key={index} className="relative group">
                                                <img src={att} alt="Upload preview" className="w-16 h-16 object-cover rounded-xl border-2 border-[#137fec]/20" />
                                                <button
                                                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-end gap-3 bg-gray-50 dark:bg-white/5 p-2 rounded-2xl border border-gray-200 dark:border-white/8 relative">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="image/*"
                                        multiple
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3.5 rounded-xl transition-all flex-shrink-0 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300"
                                        disabled={isProcessing || isGenerating || isRecording}
                                        title="Attach an image"
                                    >
                                        <ImagePlus className="w-5 h-5" />
                                    </button>

                                    <button
                                        onClick={handleVoiceInput}
                                        className={`p-3.5 rounded-xl transition-all flex-shrink-0 ${isRecording
                                            ? 'bg-red-500 text-white animate-pulse'
                                            : 'bg-[#137fec]/10 hover:bg-[#137fec]/20 text-[#137fec]'
                                            }`}
                                        disabled={isProcessing || isGenerating}
                                        title="Voice Dictation"
                                    >
                                        <Mic className="w-5 h-5" />
                                    </button>

                                    <textarea
                                        id="chat-input"
                                        value={inputText}
                                        onChange={(e) => {
                                            setInputText(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendText();
                                            }
                                        }}
                                        placeholder="Add details, attach an image, or ask anything..."
                                        className="flex-1 resize-none bg-transparent border-none py-3 px-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 focus:outline-none min-h-[44px] max-h-[200px]"
                                        rows={1}
                                        disabled={isProcessing || isRecording || isGenerating}
                                    />

                                    <button
                                        onClick={handleSendText}
                                        className="p-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white transition-all disabled:opacity-20 flex-shrink-0"
                                        disabled={(!inputText.trim() && attachments.length === 0) || isProcessing || isRecording || isGenerating}
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: SOP Preview Buffer */}
                <div className="hidden lg:flex flex-col w-1/2 bg-gray-50 dark:bg-[#0c0c0e] relative overflow-hidden">
                    {pendingUpdate && (
                        <div className="absolute inset-x-0 top-0 z-20 p-4 bg-[#137fec] text-white shadow-xl animate-in slide-in-from-top duration-300">
                            <div className="flex items-center justify-between gap-4 max-w-xl mx-auto">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg">
                                        <Sparkles className="w-5 h-5 text-yellow-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">New Improvements Ready</p>
                                        <p className="text-xs text-white/80">I've updated the SOP based on our chat. Review below.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAcceptUpdate}
                                        className="px-4 py-1.5 bg-white text-[#137fec] text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        Accept
                                    </button>
                                    <button
                                        onClick={handleRejectUpdate}
                                        className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Keep Current
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#09090b] relative z-10">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#137fec]" />
                            <span className="text-sm font-bold text-gray-700 dark:text-white/70">Document Preview</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {history.length > 0 && (
                                <button
                                    onClick={handleRollback}
                                    className="text-xs text-gray-500 hover:text-gray-900 dark:text-white/40 dark:hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Rollback
                                </button>
                            )}
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                                Live Draft
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-12 bg-white dark:bg-[#0c0c0e]">
                        <div className="max-w-[700px] mx-auto">
                            {isResearching ? (
                                <div className="flex flex-col items-center justify-center h-64 text-center">
                                    <div className="w-12 h-12 border-4 border-[#137fec]/20 border-t-[#137fec] rounded-full animate-spin mb-4" />
                                    <p className="text-sm font-medium text-gray-500 dark:text-white/40">Researched industry best practices...</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    {/* Previewing Pending State */}
                                    <div className={`prose prose-blue dark:prose-invert max-w-none transition-all duration-500 ${pendingUpdate ? 'blur-sm opacity-30 select-none' : ''}`}>
                                        <ReactMarkdown>{sopContent || '# New Standard Operating Procedure\n*Complete the interview to generate your first draft...*'}</ReactMarkdown>
                                    </div>

                                    {pendingUpdate && (
                                        <div className="absolute inset-0 z-10 animate-in fade-in duration-500">
                                            <div className="prose prose-blue dark:prose-invert max-w-none">
                                                <ReactMarkdown>{pendingUpdate}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
