import { useStore } from '../store';
import { Car, Building2 } from 'lucide-react';

export default function ModeSelector({ onContinue }: { onContinue: () => void }) {
    const { interviewMode, setInterviewMode } = useStore();

    return (
        <div className="w-full max-w-2xl mx-auto p-6 safe-area-top">
            <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-heading font-bold text-text mb-2">
                        Choose Your Mode
                    </h1>
                    <p className="text-text-light">
                        How would you like to document your process today?
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Drive Mode */}
                    <button
                        onClick={() => setInterviewMode('drive')}
                        className={`p-8 rounded-xl border-2 transition-all text-left ${interviewMode === 'drive'
                                ? 'border-primary bg-primary/5 shadow-lg scale-105'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow'
                            }`}
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mb-4">
                            <Car className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-xl font-heading font-semibold text-text mb-2">
                            Drive Mode
                        </h3>
                        <p className="text-text-light text-sm mb-4">
                            Hands-free voice documentation. Perfect for when you're on the go.
                        </p>
                        <ul className="space-y-1 text-xs text-text-lighter">
                            <li>✓ Large microphone button</li>
                            <li>✓ Voice-driven conversation</li>
                            <li>✓ Minimal distractions</li>
                            <li>✓ Hands-free operation</li>
                        </ul>
                    </button>

                    {/* Office Mode */}
                    <button
                        onClick={() => setInterviewMode('office')}
                        className={`p-8 rounded-xl border-2 transition-all text-left ${interviewMode === 'office'
                                ? 'border-primary bg-primary/5 shadow-lg scale-105'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow'
                            }`}
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mb-4">
                            <Building2 className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-xl font-heading font-semibold text-text mb-2">
                            Office Mode
                        </h3>
                        <p className="text-text-light text-sm mb-4">
                            Chat-based documentation. Ideal for quiet environments.
                        </p>
                        <ul className="space-y-1 text-xs text-text-lighter">
                            <li>✓ Type or speak responses</li>
                            <li>✓ WhatsApp-style interface</li>
                            <li>✓ Review conversation history</li>
                            <li>✓ More discreet</li>
                        </ul>
                    </button>
                </div>

                <button
                    onClick={onContinue}
                    disabled={!interviewMode}
                    className="btn-primary w-full"
                >
                    Continue to Interview
                </button>
            </div>
        </div>
    );
}
