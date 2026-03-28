import { useStore } from '../store';
import { Car, Building2, CheckCircle2 } from 'lucide-react';

export default function ModeSelector({ onContinue }: { onContinue: () => void }) {
    const { interviewMode, setInterviewMode } = useStore();

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-6 safe-area-top">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-black text-white tracking-tight mb-3">
                    Choose Your Mode
                </h1>
                <p className="text-white/40 text-sm">
                    How would you like to document your process today?
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
                {/* Drive Mode */}
                <button
                    onClick={() => setInterviewMode('drive')}
                    className={`relative p-7 rounded-2xl border transition-all text-left group ${interviewMode === 'drive'
                        ? 'border-[#137fec]/60 bg-[#137fec]/8 ring-2 ring-[#137fec]/20'
                        : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
                        }`}
                >
                    {interviewMode === 'drive' && (
                        <div className="absolute top-4 right-4">
                            <CheckCircle2 className="w-5 h-5 text-[#137fec]" />
                        </div>
                    )}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all ${interviewMode === 'drive'
                        ? 'bg-[#137fec] shadow-lg shadow-[#137fec]/25'
                        : 'bg-white/8 group-hover:bg-white/12'
                        }`}>
                        <Car className={`w-7 h-7 ${interviewMode === 'drive' ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`} />
                    </div>
                    <h3 className={`text-lg font-black tracking-tight mb-2 ${interviewMode === 'drive' ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                        Drive Mode
                    </h3>
                    <p className={`text-sm mb-4 leading-relaxed ${interviewMode === 'drive' ? 'text-white/50' : 'text-white/30'}`}>
                        Hands-free voice documentation. Perfect for when you're on the go.
                    </p>
                    <ul className="space-y-1.5">
                        {['Large microphone button', 'Voice-driven conversation', 'Minimal distractions', 'Hands-free operation'].map(f => (
                            <li key={f} className={`text-xs flex items-center gap-2 ${interviewMode === 'drive' ? 'text-white/40' : 'text-white/25'}`}>
                                <span className={`w-1 h-1 rounded-full flex-shrink-0 ${interviewMode === 'drive' ? 'bg-[#137fec]' : 'bg-white/20'}`} />
                                {f}
                            </li>
                        ))}
                    </ul>
                </button>

                {/* Office Mode */}
                <button
                    onClick={() => setInterviewMode('office')}
                    className={`relative p-7 rounded-2xl border transition-all text-left group ${interviewMode === 'office'
                        ? 'border-[#137fec]/60 bg-[#137fec]/8 ring-2 ring-[#137fec]/20'
                        : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
                        }`}
                >
                    {interviewMode === 'office' && (
                        <div className="absolute top-4 right-4">
                            <CheckCircle2 className="w-5 h-5 text-[#137fec]" />
                        </div>
                    )}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all ${interviewMode === 'office'
                        ? 'bg-[#137fec] shadow-lg shadow-[#137fec]/25'
                        : 'bg-white/8 group-hover:bg-white/12'
                        }`}>
                        <Building2 className={`w-7 h-7 ${interviewMode === 'office' ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`} />
                    </div>
                    <h3 className={`text-lg font-black tracking-tight mb-2 ${interviewMode === 'office' ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                        Office Mode
                    </h3>
                    <p className={`text-sm mb-4 leading-relaxed ${interviewMode === 'office' ? 'text-white/50' : 'text-white/30'}`}>
                        Chat-based documentation. Ideal for quiet environments.
                    </p>
                    <ul className="space-y-1.5">
                        {['Type or speak responses', 'WhatsApp-style interface', 'Review conversation history', 'More discreet'].map(f => (
                            <li key={f} className={`text-xs flex items-center gap-2 ${interviewMode === 'office' ? 'text-white/40' : 'text-white/25'}`}>
                                <span className={`w-1 h-1 rounded-full flex-shrink-0 ${interviewMode === 'office' ? 'bg-[#137fec]' : 'bg-white/20'}`} />
                                {f}
                            </li>
                        ))}
                    </ul>
                </button>
            </div>

            <button
                onClick={onContinue}
                disabled={!interviewMode}
                className="w-full py-4 rounded-2xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold tracking-wide transition-all active:scale-[0.99] shadow-xl shadow-[#137fec]/20 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
                Continue to Interview
            </button>
        </div>
    );
}
