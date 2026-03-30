import { useStore, SUPPORTED_LANGUAGES, type LanguageCode } from '../../../store';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
    const { selectedLanguage, setSelectedLanguage } = useStore();

    return (
        <div className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-white drop-shadow" />
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow">Select Language</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
                    <button
                        key={code}
                        onClick={() => setSelectedLanguage(code as LanguageCode)}
                        className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            selectedLanguage === code
                                ? 'border-[#137fec] bg-white shadow-lg shadow-[#137fec]/20 text-gray-900'
                                : 'border-white/40 bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white hover:border-white'
                        }`}
                    >
                        <p className="font-bold text-sm">{lang.nativeName}</p>
                        <p className={`text-xs mt-0.5 ${selectedLanguage === code ? 'text-gray-500' : 'text-gray-400'}`}>{lang.name}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
