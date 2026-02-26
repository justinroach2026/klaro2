import { useStore, SUPPORTED_COUNTRIES, type CountryCode } from '../store';
import { Globe } from 'lucide-react';

export default function CountrySelector() {
    const { selectedCountry, setSelectedCountry } = useStore();

    // Group countries by region
    const regions: Record<string, [string, typeof SUPPORTED_COUNTRIES[keyof typeof SUPPORTED_COUNTRIES]][]> = {};
    for (const [code, country] of Object.entries(SUPPORTED_COUNTRIES)) {
        const region = country.region;
        if (!regions[region]) regions[region] = [];
        regions[region].push([code, country]);
    }

    // Order: Europe first for EMEA rollout
    const regionOrder = ['Europe', 'Middle East', 'Africa', 'Americas', 'Asia-Pacific'];
    const sortedRegions = regionOrder.filter(r => regions[r]);

    return (
        <div className="w-full max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/30 transform rotate-3">
                        <Globe className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-slate-900 mb-3">
                        Where are you located?
                    </h1>
                    <p className="text-slate-500 text-center max-w-sm font-medium">
                        This allows Klaro to research local laws and industry-specific regulations for your region.
                    </p>
                </div>

                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2">
                    {sortedRegions.map((region) => (
                        <div key={region}>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 px-1">{region}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {regions[region].map(([code, country]) => (
                                    <button
                                        key={code}
                                        onClick={() => setSelectedCountry(code as CountryCode)}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all group ${selectedCountry === code
                                            ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span className="text-2xl group-hover:scale-110 transition-transform">
                                            {country.flag}
                                        </span>
                                        <div className="text-left min-w-0">
                                            <div className="font-bold text-slate-900 text-sm truncate">{country.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{country.currency}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
