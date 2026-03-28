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
    Building,
    CheckCircle2
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
            <div className="flex flex-col items-center mb-8 md:mb-12">
                <div className="w-16 h-16 bg-[#137fec]/10 border border-[#137fec]/20 rounded-2xl flex items-center justify-center mb-6">
                    <Building2 className="w-8 h-8 text-[#137fec]" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight mb-3 text-center">
                    Select Your Industry
                </h1>
                <p className="text-white/40 text-center max-w-sm text-sm leading-relaxed">
                    This helps the AI understand your specific workflows and provide expert advice.
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                {Object.entries(SUPPORTED_INDUSTRIES).map(([code, industry]) => {
                    const Icon = icons[industry.icon] || Layout;
                    const isSelected = selectedIndustry === code;
                    return (
                        <button
                            key={code}
                            onClick={() => setSelectedIndustry(code as IndustryCode)}
                            className={`relative flex flex-col items-start p-5 rounded-2xl border transition-all text-left group ${isSelected
                                ? 'border-[#137fec]/60 bg-[#137fec]/8 ring-2 ring-[#137fec]/20'
                                : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6'
                                }`}
                        >
                            {isSelected && (
                                <div className="absolute top-3 right-3">
                                    <CheckCircle2 className="w-4 h-4 text-[#137fec]" />
                                </div>
                            )}
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 md:mb-4 transition-all ${isSelected
                                ? 'bg-[#137fec] text-white shadow-lg shadow-[#137fec]/20'
                                : 'bg-white/8 text-white/40 group-hover:bg-white/12 group-hover:text-white/60'
                                }`}>
                                <Icon className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div className={`font-bold text-sm mb-1 transition-colors ${isSelected ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                                {industry.name}
                            </div>
                            <div className="text-xs text-white/30 leading-relaxed group-hover:text-white/40 transition-colors">
                                {industry.description}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
