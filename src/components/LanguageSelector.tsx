import { useStore, SUPPORTED_LANGUAGES, type LanguageCode } from '../store';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
    const { selectedLanguage, setSelectedLanguage } = useStore();

    return (
        <div className="w-full max-w-md mx-auto p-6 safe-area-top">
            <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
                        <Globe className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-heading font-bold text-text mb-2">
                        Choose Your Language
                    </h1>
                    <p className="text-text-light text-center">
                        Select the language for your interview
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
                        <button
                            key={code}
                            onClick={() => setSelectedLanguage(code as LanguageCode)}
                            className={`p-4 rounded-lg border-2 transition-all ${selectedLanguage === code
                                ? 'border-primary bg-primary/5'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="text-2xl mb-1">{getFlagEmoji(code as LanguageCode)}</div>
                            <div className="font-medium text-sm text-text">{lang.nativeName}</div>
                            <div className="text-xs text-text-lighter">{lang.name}</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function getFlagEmoji(code: LanguageCode): string {
    const flags: Record<LanguageCode, string> = {
        en: '🇬🇧',
        es: '🇪🇸',
        nl: '🇳🇱',
        fr: '🇫🇷',
        de: '🇩🇪',
        it: '🇮🇹',
        pt: '🇵🇹',
        pl: '🇵🇱',
    };
    return flags[code] || '🌐';
}
