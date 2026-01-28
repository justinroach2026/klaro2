import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { voiceEngine } from '../lib/voice';
import { AIInterviewer } from '../lib/ai/interviewer';
import { Mic, StopCircle } from 'lucide-react';

export default function DriveMode() {
    const {
        selectedLanguage,
        isRecording,
        isSpeaking,
        addMessage,
        setIsRecording,
        setIsSpeaking,
    } = useStore();

    const [currentTranscript, setCurrentTranscript] = useState('');
    const [currentAIResponse, setCurrentAIResponse] = useState('');
    const [isPressing, setIsPressing] = useState(false);

    const aiInterviewer = useRef(new AIInterviewer(selectedLanguage));
    const pressTimer = useRef<number | null>(null);

    useEffect(() => {
        // Load voices when component mounts
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }

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
                setCurrentAIResponse(greeting);
                addMessage({ role: 'ai', content: greeting });
                setIsSpeaking(true);
                await voiceEngine.speak(greeting, selectedLanguage);
                setIsSpeaking(false);
            }
        };

        greet();
    }, [selectedLanguage]);

    const handlePressStart = () => {
        setIsPressing(true);

        // Start recording after 100ms to avoid accidental taps
        pressTimer.current = window.setTimeout(async () => {
            try {
                await voiceEngine.startRecording();
                setIsRecording(true);
            } catch (error) {
                console.error('Recording error:', error);
                alert('Failed to start recording. Please check microphone permissions.');
            }
        }, 100);
    };

    const handlePressEnd = async () => {
        setIsPressing(false);

        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }

        if (!isRecording) return;

        try {
            // Stop recording
            const audioBlob = await voiceEngine.stopRecording();
            setIsRecording(false);

            // Transcribe audio
            const { text } = await voiceEngine.transcribe(audioBlob, selectedLanguage);
            setCurrentTranscript(text);
            addMessage({ role: 'user', content: text });

            // Get AI response
            const aiResponse = await aiInterviewer.current.getResponse(text);
            setCurrentAIResponse(aiResponse);
            addMessage({ role: 'ai', content: aiResponse });

            // Speak AI response
            setIsSpeaking(true);
            await voiceEngine.speak(aiResponse, selectedLanguage);
            setIsSpeaking(false);

            // Clear transcript after a moment
            setTimeout(() => setCurrentTranscript(''), 2000);
        } catch (error) {
            console.error('Processing error:', error);
            setIsRecording(false);
            setIsSpeaking(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 flex flex-col items-center justify-between p-6 safe-area-top safe-area-bottom">
            {/* Header */}
            <div className="w-full max-w-md">
                <div className="glass rounded-lg p-4 text-white text-center">
                    <h2 className="text-sm font-medium opacity-90">Drive Mode</h2>
                    <p className="text-xs opacity-75 mt-1">Hands-free voice documentation</p>
                </div>
            </div>

            {/* Transcript Display */}
            <div className="w-full max-w-2xl space-y-4">
                {currentTranscript && (
                    <div className="glass rounded-lg p-4">
                        <p className="text-xs text-white/60 mb-1">You said:</p>
                        <p className="text-white text-lg">{currentTranscript}</p>
                    </div>
                )}

                {currentAIResponse && (
                    <div className="glass rounded-lg p-4">
                        <p className="text-xs text-white/60 mb-1">AI:</p>
                        <p className="text-white text-lg">{currentAIResponse}</p>
                    </div>
                )}

                {isSpeaking && (
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 text-white/80 text-sm">
                            <span className="animate-pulse">Speaking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Microphone Button */}
            <div className="flex flex-col items-center gap-6">
                <button
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
                    onTouchCancel={handlePressEnd}
                    className={`mic-button ${isRecording ? 'active' : ''}`}
                    disabled={isSpeaking}
                >
                    {isRecording ? (
                        <StopCircle className="w-20 h-20 text-white" />
                    ) : (
                        <Mic className="w-20 h-20 text-white" />
                    )}
                </button>

                <div className="text-center space-y-2">
                    <p className="text-white font-medium">
                        {isRecording ? 'Release to send' : 'Hold to talk'}
                    </p>
                    <p className="text-white/70 text-sm">
                        {isPressing && !isRecording ? 'Keep holding...' : ''}
                    </p>
                </div>
            </div>
        </div>
    );
}
