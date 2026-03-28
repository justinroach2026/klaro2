import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore, SUPPORTED_INDUSTRIES } from '../store';
import { INDUSTRY_TEMPLATES } from '../lib/templates';
import ThemeToggle from '../components/ThemeToggle';
import {
    Plus,
    Search,
    FileText,
    MoreVertical,
    Clock,
    Globe2,
    ArrowRight,
    Settings,
    LogOut
} from 'lucide-react';

interface SOP {
    id: string;
    title: string;
    content: string;
    language: string;
    created_at: string;
    updated_at: string;
    tags?: string[];
    version?: number;
    profiles?: {
        full_name: string;
    };
}

export default function Dashboard({ onNewSOP, onViewSOP, onSettings }: {
    onNewSOP: () => void;
    onViewSOP: (sop: SOP) => void;
    onSettings: () => void;
}) {
    const [sops, setSops] = useState<SOP[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const { user, selectedIndustry, setIsLoading, setError, isLoading } = useStore();
    const templates = INDUSTRY_TEMPLATES[selectedIndustry] || INDUSTRY_TEMPLATES.other;

    useEffect(() => {
        const fetchSOPs = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                const response = await supabase
                    ?.from('sops')
                    .select('*, profiles(full_name)')
                    .order('updated_at', { ascending: false });

                const data = response?.data;
                const error = response?.error;

                if (error) throw error;
                setSops(data || []);
            } catch (err: any) {
                console.error('Error fetching SOPs:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSOPs();
    }, [user, setIsLoading, setError]);

    const filteredSops = sops.filter(sop =>
        sop.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background-alt pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <h1 className="text-xl font-heading font-bold text-text">Klaro</h1>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <button className="p-2 text-text-light hover:bg-gray-100 rounded-full" onClick={() => setSearchQuery('')}>
                            <Search className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-text-light hover:bg-gray-100 rounded-full" onClick={onSettings} title="Settings">
                            <Settings className="w-5 h-5" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer"
                            >
                                {user?.email?.substring(0, 1).toUpperCase()}
                            </button>
                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-sm font-bold text-text truncate">{user?.email}</p>
                                            <p className="text-xs text-text-lighter mt-0.5">Signed in</p>
                                        </div>
                                        <button
                                            onClick={() => { setShowUserMenu(false); onSettings(); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-light hover:bg-gray-50 transition-colors"
                                        >
                                            <Settings className="w-4 h-4" />
                                            Settings
                                        </button>
                                        <div className="border-t border-gray-100 my-1" />
                                        <button
                                            onClick={async () => {
                                                setShowUserMenu(false);
                                                await supabase?.auth.signOut();
                                                window.location.reload();
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8">
                {/* Welcome & Stats */}
                <div className="mb-8">
                    <h2 className="text-2xl font-heading font-bold text-text mb-2">
                        Welcome back!
                    </h2>
                    <p className="text-text-light">
                        You have {sops.length} Standard Operating Procedures.
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                    <button
                        onClick={onNewSOP}
                        className="flex items-center p-6 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform text-left"
                    >
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-bold text-lg">Create New SOP</div>
                            <div className="text-white/80 text-sm">Start a voice interview</div>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto opacity-60" />
                    </button>

                </div>

                {/* Template Suggestions */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-text uppercase text-xs tracking-wider">
                                💡 SOP Ideas for {SUPPORTED_INDUSTRIES[selectedIndustry].name}
                            </h3>
                            <p className="text-text-lighter text-xs mt-1">Common processes in your industry — click to start creating</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {templates.map((template) => (
                            <button
                                key={template.title}
                                onClick={() => onViewSOP({
                                    id: `template-${template.title}`,
                                    title: template.title,
                                    content: template.content,
                                    language: 'en',
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                    tags: template.tags,
                                })}
                                className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-left group"
                            >
                                <div className="text-2xl mt-0.5">{template.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm text-text group-hover:text-primary transition-colors">{template.title}</h4>
                                    <p className="text-xs text-text-lighter mt-1 leading-relaxed">{template.description}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {template.tags.map(tag => (
                                            <span key={tag} className="text-[10px] bg-primary/5 text-primary/70 px-2 py-0.5 rounded-full font-bold">#{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* SOP List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-text uppercase text-xs tracking-wider">
                            Recent Documentation
                        </h3>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center py-20 grayscale opacity-20">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <span>Loading your library...</span>
                        </div>
                    ) : filteredSops.length > 0 ? (
                        filteredSops.map((sop) => (
                            <div
                                key={sop.id}
                                className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4 group"
                                onClick={() => onViewSOP(sop)}
                            >
                                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-text-lighter group-hover:bg-primary/5 group-hover:text-primary transition-colors relative">
                                    <FileText className="w-6 h-6" />
                                    {sop.version && (
                                        <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-black px-1 rounded shadow-sm border border-white">
                                            V{sop.version}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-text truncate group-hover:text-primary transition-colors">{sop.title}</h4>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-text-lighter uppercase tracking-tight">
                                            <Globe2 className="w-3 h-3" />
                                            {sop.language}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-text-lighter uppercase tracking-tight">
                                            <Clock className="w-3 h-3" />
                                            {new Date(sop.updated_at).toLocaleDateString()}
                                        </div>
                                        {sop.tags && sop.tags.slice(0, 2).map(tag => (
                                            <span key={tag} className="text-[10px] bg-primary/5 text-primary px-2 py-0.5 rounded-full font-bold">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button className="p-2 text-text-lighter hover:text-text transition-colors">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <button
                            onClick={onNewSOP}
                            className="w-full block text-center py-20 bg-white hover:bg-gray-50 transition-colors rounded-3xl border-2 border-dashed border-gray-200 cursor-pointer"
                        >
                            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 text-primary/30">
                                <Plus className="w-10 h-10" />
                            </div>
                            <h4 className="font-heading font-bold text-xl text-text mb-2">Start your first SOP</h4>
                            <p className="text-text-light text-sm px-10 max-w-sm mx-auto">
                                Documentation doesn't have to be a chore. Let our AI guide you through a voice interview.
                            </p>
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
