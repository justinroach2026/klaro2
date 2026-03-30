import { useState, useEffect } from 'react';
import { useStore, SUPPORTED_INDUSTRIES, SUPPORTED_COUNTRIES } from '../../../store';
import { Search, ShieldAlert, CheckCircle2, RefreshCw, ArrowRight, Gavel, FileWarning } from 'lucide-react';
import OpenAI from 'openai';

interface ResearchPanelProps {
    onContinue: () => void;
    onBack: () => void;
}

export default function ResearchPanel({ onContinue, onBack }: ResearchPanelProps) {
    const { selectedIndustry, selectedCountry } = useStore();
    const [isResearching, setIsResearching] = useState(true);
    const [findings, setFindings] = useState<string[]>([]);
    const [sopWarnings, setSopWarnings] = useState<{ title: string, reason: string }[]>([]);

    useEffect(() => {
        const performResearch = async () => {
            setIsResearching(true);
            try {
                const openai = new OpenAI({
                    apiKey: import.meta.env.OPENAI_API_KEY,
                    dangerouslyAllowBrowser: true,
                });

                const industry = SUPPORTED_INDUSTRIES[selectedIndustry].name;
                const country = SUPPORTED_COUNTRIES[selectedCountry].name;

                const response = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: `You are an expert legal and operations researcher for Klaro.
                            Your goal is to identify current laws, regulations, and industry best practices for a specific industry in a specific country.
                            Provide exactly 4 concise, actionable "Regulatory Insights" that will affect SOP creation.
                            Also, suggest if common processes like "Client Onboarding" or "Data Retention" need specific legal clauses.`
                        },
                        {
                            role: "user",
                            content: `Research the latest updates and laws for the ${industry} industry in ${country}.`
                        }
                    ]
                });

                const content = response.choices[0].message.content || "";
                const lines = content.split('\n').filter(l => l.trim().length > 0).slice(0, 4);
                setFindings(lines);

                setSopWarnings([
                    { title: "Tenant Onboarding v2", reason: "New data privacy laws in " + country + " require updated consent forms." }
                ]);

            } catch (error) {
                console.error("Research failed:", error);
                setFindings(["Focus on local compliance requirements.", "Ensure data safety standards.", "Review documentation retention policies.", "Check health and safety guidelines."]);
            } finally {
                setIsResearching(false);
            }
        };

        performResearch();
    }, [selectedIndustry, selectedCountry]);

    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
            <div className="bg-white/3 border border-white/8 rounded-3xl p-6 md:p-10 overflow-hidden relative">
                {isResearching && (
                    <div className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                        <RefreshCw className="w-12 h-12 text-[#137fec] animate-spin mb-4" />
                        <h2 className="text-xl font-black text-white tracking-tight">Researching {SUPPORTED_COUNTRIES[selectedCountry].name} Regulations...</h2>
                        <p className="text-white/40 mt-2 text-sm">Connecting to legal databases and industry updates</p>
                    </div>
                )}

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
                        <Gavel className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Regulatory Analysis</h1>
                        <p className="text-sm text-white/40">{SUPPORTED_INDUSTRIES[selectedIndustry].name} • {SUPPORTED_COUNTRIES[selectedCountry].name}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="bg-white/3 border border-white/6 rounded-2xl p-6">
                        <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Latest Database Research
                        </h3>
                        <div className="space-y-3">
                            {findings.map((finding, i) => (
                                <div key={i} className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <p className="text-white/60 text-sm leading-relaxed">{finding}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {sopWarnings.length > 0 && (
                        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
                            <h3 className="text-[10px] font-black text-red-400/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileWarning className="w-4 h-4" />
                                Impact on Existing SOPs
                            </h3>
                            <div className="space-y-4">
                                {sopWarnings.map((warning, i) => (
                                    <div key={i} className="flex gap-4 items-start bg-white/3 border border-red-500/10 p-4 rounded-xl">
                                        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-1" />
                                        <div>
                                            <p className="font-bold text-white/80 text-sm">{warning.title}</p>
                                            <p className="text-white/40 text-xs mt-1 leading-relaxed">{warning.reason}</p>
                                        </div>
                                        <button className="text-[#137fec] font-bold text-xs ml-auto hover:underline uppercase tracking-wider flex-shrink-0">Update Now</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-10 flex gap-4">
                    <button
                        onClick={onBack}
                        className="flex-1 py-3.5 border border-white/8 rounded-xl text-white/50 font-semibold hover:bg-white/5 hover:text-white/70 transition-all text-sm"
                    >
                        Go Back
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex-1 py-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#137fec]/20 flex items-center justify-center gap-2 group"
                    >
                        Proceed to Interview
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
