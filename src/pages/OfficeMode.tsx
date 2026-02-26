import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store';
import { voiceEngine } from '../lib/voice';
import { AIInterviewer } from '../lib/ai/interviewer';
import { supabase } from '../lib/supabase';
import { Mic, Send } from 'lucide-react';

export default function OfficeMode() {
    const {
        selectedLanguage,
        selectedIndustry,
        selectedCountry,
        profile,
        isRecording,
        addMessage,
        interviewMessages,
        setIsRecording,
    } = useStore();

    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showGenerateButton, setShowGenerateButton] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    const aiInterviewer = useRef(new AIInterviewer(selectedLanguage, selectedIndustry, selectedCountry, profile?.agentic_prompt));
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Auto-scroll to bottom — scroll the container itself for reliable behavior
        const container = scrollContainerRef.current;
        if (container) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    }, [interviewMessages, isProcessing]);

    useEffect(() => {
        // Start with AI greeting
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

            if (greeting) {
                addMessage({ role: 'ai', content: greeting });
            }
        };

        if (interviewMessages.length === 0) {
            greet();
        }
    }, [selectedLanguage]);

    useEffect(() => {
        // Check if AI is ready to generate SOP
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
                "Mam wszystkie potrzebne informacje"
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

            // Find process title from conversation
            const firstUserMessage = interviewMessages.find(m => m.role === 'user')?.content || 'Untitled SOP';
            const title = firstUserMessage.length > 50 ? firstUserMessage.substring(0, 50) + '...' : firstUserMessage;

            // Build company/user info string for the prompt
            const authorInfo = `
Author: ${profile?.full_name || user.email || 'Author'}
Company: ${profile?.company_name || team?.name || 'Company'}
${profile?.company_website ? `Website: ${profile.company_website}` : ''}
${profile?.company_address ? `Location: ${profile.company_address}` : ''}
            `.trim();

            // 1. Generate Content with enhanced structure
            const content = await aiInterviewer.current.generateSOP(title, authorInfo);

            // 2. Extract Metadata automatically
            const metadata = await aiInterviewer.current.extractMetadata(title);

            // 3. Save to Supabase
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
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 safe-area-top">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-heading font-semibold text-text">Office Mode</h2>
                        <p className="text-sm text-text-light">Chat-based documentation</p>
                    </div>
                    {showGenerateButton && (
                        <button
                            onClick={handleGenerateSOP}
                            disabled={isGenerating}
                            className="btn-primary py-2 px-6 animate-bounce shadow-lg shadow-primary/30"
                        >
                            {isGenerating ? 'Generating...' : 'Generate SOP Now'}
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {interviewMessages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`chat-bubble ${message.role}`}>
                                {message.role === 'ai' ? (
                                    <div className="prose prose-sm max-w-none prose-p:mb-2 prose-p:last:mb-0 prose-ul:list-disc prose-ol:list-decimal prose-ul:ml-5 prose-ol:ml-5 prose-li:pl-1 text-inherit">
                                        <ReactMarkdown>{message.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <p>{message.content}</p>
                                )}
                                <span className="text-xs opacity-60 mt-1 block">
                                    {new Date(message.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="flex justify-start">
                            <div className="chat-bubble ai">
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-text-light rounded-full animate-pulse"></span>
                                    <span className="w-2 h-2 bg-text-light rounded-full animate-pulse delay-75"></span>
                                    <span className="w-2 h-2 bg-text-light rounded-full animate-pulse delay-150"></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input / Success State */}
            <div className="bg-white border-t border-gray-200 p-4 safe-area-bottom">
                {isComplete ? (
                    <div className="max-w-4xl mx-auto flex flex-col items-center py-4">
                        <button
                            onClick={() => {
                                // Find the close/exit button that app.tsx uses and click it, 
                                // or update a state route if we have one. In App.tsx it's fixed button.
                                // We can trigger a reload to reset the state safely to /
                                window.location.href = '/';
                            }} // This will trigger App's re-render to dashboard
                            className="btn-primary w-full max-w-sm py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto flex items-center gap-2">
                        <button
                            onClick={handleVoiceInput}
                            className={`p-3 rounded-lg transition-colors ${isRecording
                                ? 'bg-red-500 text-white'
                                : 'bg-background-dark hover:bg-background-dark/80 text-text'
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
                            className="input-primary flex-1 resize-none overflow-y-auto min-h-[46px] max-h-32 py-2.5"
                            rows={1}
                            disabled={isProcessing || isRecording || isGenerating}
                        />

                        <button
                            onClick={handleSendText}
                            className="btn-primary"
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
