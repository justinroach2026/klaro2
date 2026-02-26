import { useState, useEffect } from 'react';
import { useStore, SUPPORTED_INDUSTRIES, SUPPORTED_COUNTRIES } from '../store';
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

                // Simulate checking existing SOPs (mock logic for now)
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
        <div className="w-full max-w-3xl mx-auto p-6">
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 overflow-hidden relative">
                {isResearching && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                        <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                        <h2 className="text-xl font-bold text-slate-900">Researching {SUPPORTED_COUNTRIES[selectedCountry].name} Regulations...</h2>
                        <p className="text-slate-500 mt-2">Connecting to legal databases and industry updates</p>
                    </div>
                )}

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                        <Gavel className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Regulatory Analysis</h1>
                        <p className="text-sm text-slate-500">{SUPPORTED_INDUSTRIES[selectedIndustry].name} • {SUPPORTED_COUNTRIES[selectedCountry].name}</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Latest Database Research
                        </h3>
                        <div className="space-y-3">
                            {findings.map((finding, i) => (
                                <div key={i} className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <p className="text-slate-700 text-sm">{finding}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {sopWarnings.length > 0 && (
                        <div className="bg-rose-50 rounded-2xl p-6 border border-rose-100">
                            <h3 className="text-sm font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileWarning className="w-4 h-4" />
                                Impact on Existing SOPs
                            </h3>
                            <div className="space-y-4">
                                {sopWarnings.map((warning, i) => (
                                    <div key={i} className="flex gap-4 items-start bg-white p-4 rounded-xl border border-rose-200">
                                        <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">{warning.title}</p>
                                            <p className="text-slate-600 text-xs mt-1 leading-relaxed">{warning.reason}</p>
                                        </div>
                                        <button className="text-indigo-600 font-bold text-xs ml-auto hover:underline uppercase tracking-wider">Update Now</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-10 flex gap-4">
                    <button onClick={onBack} className="btn-secondary flex-1">
                        Go Back
                    </button>
                    <button onClick={onContinue} className="btn-primary flex-1 group">
                        Proceed to Interview
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
