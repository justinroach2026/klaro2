import { useStore } from '../../../store';
import { Car, Building2, CheckCircle2 } from 'lucide-react';

export default function ModeSelector({ onContinue }: { onContinue: () => void }) {
    const { interviewMode, setInterviewMode } = useStore();

    return (
        <div className="w-full max-w-lg">
            <div className="mb-8 text-center">
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow">Choose Interview Mode</h2>
                <p className="text-white/80 text-sm mt-2 drop-shadow">How would you like to document your process?</p>
            </div>
            <div className="grid grid-cols-1 gap-4 mb-8">
                <button
                    onClick={() => setInterviewMode('drive')}
                    className={`p-6 rounded-2xl border-2 transition-all text-left flex items-center gap-5 ${
                        interviewMode === 'drive'
                            ? 'border-[#137fec] bg-white shadow-xl shadow-[#137fec]/20'
                            : 'border-white/40 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-white hover:shadow-lg'
                    }`}
                >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${interviewMode === 'drive' ? 'bg-[#137fec]/10 text-[#137fec]' : 'bg-gray-100 text-gray-400'}`}>
                        <Car className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={`font-black ${interviewMode === 'drive' ? 'text-gray-900' : 'text-gray-800'}`}>Drive Mode</h3>
                            {interviewMode === 'drive' && <CheckCircle2 className="w-4 h-4 text-[#137fec]" />}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Hands-free voice documentation. Speak naturally and I'll capture everything.</p>
                    </div>
                </button>

                <button
                    onClick={() => setInterviewMode('office')}
                    className={`p-6 rounded-2xl border-2 transition-all text-left flex items-center gap-5 ${
                        interviewMode === 'office'
                            ? 'border-[#137fec] bg-white shadow-xl shadow-[#137fec]/20'
                            : 'border-white/40 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-white hover:shadow-lg'
                    }`}
                >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${interviewMode === 'office' ? 'bg-[#137fec]/10 text-[#137fec]' : 'bg-gray-100 text-gray-400'}`}>
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={`font-black ${interviewMode === 'office' ? 'text-gray-900' : 'text-gray-800'}`}>Office Mode</h3>
                            {interviewMode === 'office' && <CheckCircle2 className="w-4 h-4 text-[#137fec]" />}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Chat-based documentation. Type or use voice with a guided conversation.</p>
                    </div>
                </button>
            </div>

            <button
                onClick={onContinue}
                disabled={!interviewMode}
                className="w-full py-3.5 rounded-xl bg-white hover:bg-white/90 text-[#137fec] font-bold text-sm tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            >
                Start Interview
            </button>
        </div>
    );
}
