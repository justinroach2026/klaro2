import { useStore, SUPPORTED_COUNTRIES, type CountryCode } from '../../../store';
import { Globe } from 'lucide-react';

export default function CountrySelector() {
    const { selectedCountry, setSelectedCountry } = useStore();

    const regions: Record<string, [string, typeof SUPPORTED_COUNTRIES[keyof typeof SUPPORTED_COUNTRIES]][]> = {};
    for (const [code, c] of Object.entries(SUPPORTED_COUNTRIES)) {
        if (!regions[c.region]) regions[c.region] = [];
        regions[c.region].push([code, c]);
    }
    const regionOrder = ['Europe', 'Middle East', 'Africa', 'Americas', 'Asia-Pacific'];

    return (
        <div className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-white drop-shadow" />
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow">Select Country</h2>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {regionOrder.filter(r => regions[r]).map((region) => (
                    <div key={region}>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2 drop-shadow">{region}</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {regions[region].map(([code, c]) => (
                                <button
                                    key={code}
                                    onClick={() => setSelectedCountry(code as CountryCode)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${
                                        selectedCountry === code
                                            ? 'border-[#137fec] bg-white shadow-md shadow-[#137fec]/20 text-gray-900 font-bold'
                                            : 'border-white/40 bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white hover:border-white'
                                    }`}
                                >
                                    <span className="text-lg">{c.flag}</span>
                                    <span className="truncate">{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
