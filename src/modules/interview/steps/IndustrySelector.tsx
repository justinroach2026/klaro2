import { useStore, SUPPORTED_INDUSTRIES, type IndustryCode } from '../../../store';

export default function IndustrySelector() {
    const { selectedIndustry, setSelectedIndustry } = useStore();

    return (
        <div className="w-full max-w-5xl">
            <div className="mb-6">
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow">Select Industry</h2>
                <p className="text-white/80 text-sm mt-1 drop-shadow">Tailors AI suggestions to your sector</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(SUPPORTED_INDUSTRIES).map(([code, ind]) => (
                    <button
                        key={code}
                        onClick={() => setSelectedIndustry(code as IndustryCode)}
                        className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all text-left ${
                            selectedIndustry === code
                                ? 'border-[#137fec] bg-white shadow-lg shadow-[#137fec]/20'
                                : 'border-white/40 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-white'
                        }`}
                    >
                        <span className={`font-bold text-sm ${selectedIndustry === code ? 'text-[#137fec]' : 'text-gray-800'}`}>{ind.name}</span>
                        <span className="text-xs text-gray-500 mt-0.5">{ind.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
