import { useStore, SUPPORTED_INDUSTRIES, type IndustryCode } from '../store';
import {
    Code,
    Stethoscope,
    Hotel,
    Factory,
    Briefcase,
    GraduationCap,
    ShoppingBag,
    HardHat,
    Layout,
    Building2,
    Building
} from 'lucide-react';

const icons: Record<string, any> = {
    Code,
    Stethoscope,
    Hotel,
    Factory,
    Briefcase,
    GraduationCap,
    ShoppingBag,
    HardHat,
    Layout,
    Building
};

export default function IndustrySelector() {
    const { selectedIndustry, setSelectedIndustry } = useStore();

    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
            <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-100">
                <div className="flex flex-col items-center mb-6 md:mb-10">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 transform -rotate-3">
                        <Building2 className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-slate-900 mb-3">
                        Select Your Industry
                    </h1>
                    <p className="text-slate-500 text-center max-w-sm font-medium">
                        This helps the AI understand your specific workflows and provide expert advice.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                    {Object.entries(SUPPORTED_INDUSTRIES).map(([code, industry]) => {
                        const Icon = icons[industry.icon] || Layout;
                        return (
                            <button
                                key={code}
                                onClick={() => setSelectedIndustry(code as IndustryCode)}
                                className={`flex flex-col items-start p-5 rounded-2xl border-2 transition-all text-left group ${selectedIndustry === code
                                    ? 'border-blue-600 bg-blue-50/50 ring-4 ring-blue-50'
                                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 md:mb-4 transition-colors ${selectedIndustry === code
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                                    }`}>
                                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <div className="font-bold text-slate-900 mb-1">{industry.name}</div>
                                <div className="text-xs text-slate-500 leading-relaxed">{industry.description}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
