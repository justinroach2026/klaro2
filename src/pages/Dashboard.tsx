import { useEffect, useState } from 'react';
import { supabase, getOverdueSOPs, markSOPReviewed } from '../lib/supabase';
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
    LogOut,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Shield,
    Link2,
    Lock
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
    owner_id?: string | null;
    review_interval_days?: number | null;
    last_reviewed_at?: string | null;
    next_review_at?: string | null;
    related_sop_ids?: string[];
    profiles?: {
        full_name: string;
    };
}

interface OverdueSOP {
    id: string;
    title: string;
    next_review_at: string;
    last_reviewed_at: string | null;
    review_interval_days: number;
    updated_at: string;
    version: number;
    owner_id: string;
}

export default function Dashboard({ onNewSOP, onViewSOP, onSettings }: {
    onNewSOP: () => void;
    onViewSOP: (sop: SOP) => void;
    onSettings: () => void;
}) {
    const [sops, setSops] = useState<SOP[]>([]);
    const [overdueSOPs, setOverdueSOPs] = useState<OverdueSOP[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [depAlertCount, setDepAlertCount] = useState(0);
    const { user, profile, selectedIndustry, setIsLoading, setError, isLoading } = useStore();
    const templates = INDUSTRY_TEMPLATES[selectedIndustry] || INDUSTRY_TEMPLATES.other;
    const isCreator = !profile?.role || profile.role === 'creator'; // default to creator

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

                // Check for dependency alerts: related SOPs updated since last review
                let depCount = 0;
                for (const sop of (data || [])) {
                    if (sop.related_sop_ids?.length > 0 && sop.last_reviewed_at) {
                        const reviewDate = new Date(sop.last_reviewed_at);
                        // Check if any related SOP was updated after last review
                        for (const relSop of (data || [])) {
                            if (sop.related_sop_ids.includes(relSop.id) && new Date(relSop.updated_at) > reviewDate) {
                                depCount++;
                                break; // count parent SOP only once
                            }
                        }
                    }
                }
                setDepAlertCount(depCount);
            } catch (err: any) {
                console.error('Error fetching SOPs:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        const fetchOverdue = async () => {
            if (!user) return;
            try {
                const data = await getOverdueSOPs(user.id);
                setOverdueSOPs(data as OverdueSOP[]);
            } catch (err) {
                console.error('Error fetching overdue SOPs:', err);
            }
        };

        fetchSOPs();
        fetchOverdue();
    }, [user, setIsLoading, setError]);

    const handleMarkReviewed = async (sopId: string) => {
        try {
            await markSOPReviewed(sopId);
            setOverdueSOPs(prev => prev.filter(s => s.id !== sopId));
        } catch (err) {
            console.error('Failed to mark reviewed:', err);
        }
    };

    const filteredSops = sops.filter(sop =>
        sop.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#09090b]">
            {/* Background ambient glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-15%] left-[30%] w-[700px] h-[500px] bg-[#137fec]/6 rounded-full blur-[140px]" />
                <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] bg-purple-700/5 rounded-full blur-[120px]" />
            </div>

            {/* Header */}
            <header className="fixed top-0 inset-x-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#137fec] rounded-lg flex items-center justify-center shadow-md shadow-[#137fec]/30">
                            <Zap className="w-4 h-4 text-white" fill="currentColor" />
                        </div>
                        <span className="text-lg font-black text-white tracking-tight">Klaro</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button
                            className="p-2 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all"
                            onClick={() => setSearchQuery('')}
                            title="Search"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                        <button
                            className="p-2 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all"
                            onClick={onSettings}
                            title="Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Avatar */}
                        <div className="relative ml-1">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-8 h-8 bg-[#137fec] rounded-lg flex items-center justify-center text-white font-black text-xs hover:ring-2 hover:ring-[#137fec]/40 transition-all cursor-pointer"
                            >
                                {user?.email?.substring(0, 1).toUpperCase()}
                            </button>
                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-[#121214] border border-white/8 rounded-2xl shadow-2xl py-2 z-50">
                                        <div className="px-4 py-3 border-b border-white/5">
                                            <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                    isCreator
                                                        ? 'bg-[#137fec]/15 text-[#137fec]'
                                                        : 'bg-white/8 text-white/40'
                                                }`}>
                                                    {isCreator ? 'Creator' : 'Viewer'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setShowUserMenu(false); onSettings(); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
                                        >
                                            <Settings className="w-4 h-4" />
                                            Settings
                                        </button>
                                        <div className="border-t border-white/5 my-1" />
                                        <button
                                            onClick={async () => {
                                                setShowUserMenu(false);
                                                await supabase?.auth.signOut();
                                                window.location.reload();
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/8 transition-colors"
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

            <main className="relative max-w-6xl mx-auto px-6 pt-28 pb-16">
                {/* Welcome */}
                <div className="mb-10">
                    <p className="text-xs font-bold text-[#137fec] uppercase tracking-widest mb-2">Dashboard</p>
                    <h2 className="text-4xl font-black text-white tracking-tight mb-2">
                        Welcome back!
                    </h2>
                    <p className="text-white/40 text-lg">
                        You have <span className="text-white/70 font-bold">{sops.length}</span> Standard Operating Procedures.
                    </p>
                </div>

                {/* ─── Overdue Review Section ─── */}
                {overdueSOPs.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                                Needs Review ({overdueSOPs.length})
                            </span>
                        </div>
                        <div className="space-y-3">
                            {overdueSOPs.map(sop => {
                                const daysOverdue = Math.floor((Date.now() - new Date(sop.next_review_at).getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                    <div key={sop.id} className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl">
                                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white/80 truncate">{sop.title}</p>
                                            <p className="text-xs text-amber-400/70 font-bold mt-0.5">
                                                Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} · V{sop.version}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleMarkReviewed(sop.id)}
                                            className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Reviewed
                                        </button>
                                        <button
                                            onClick={() => {
                                                const fullSop = sops.find(s => s.id === sop.id);
                                                if (fullSop) onViewSOP(fullSop);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold transition-all"
                                        >
                                            Open
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── Dependency Alert ─── */}
                {depAlertCount > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-[#137fec]/5 border border-[#137fec]/15 rounded-2xl mb-8">
                        <Link2 className="w-5 h-5 text-[#137fec] flex-shrink-0" />
                        <p className="text-sm text-[#137fec]/80 font-bold">
                            {depAlertCount} SOP{depAlertCount !== 1 ? 's have' : ' has'} linked dependencies that were updated since your last review.
                        </p>
                    </div>
                )}

                {/* ─── No overdue — all clear ─── */}
                {overdueSOPs.length === 0 && sops.length > 0 && (
                    <div className="flex items-center gap-2 p-3 mb-8 opacity-50">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-bold text-green-400/80">All SOPs up to date ✓</span>
                    </div>
                )}

                {/* CTA card — only for Creators */}
                {isCreator ? (
                    <div className="mb-12">
                        <button
                            onClick={onNewSOP}
                            className="group relative overflow-hidden flex items-center gap-6 w-full md:w-auto p-7 bg-gradient-to-r from-[#137fec] to-[#0f66bd] rounded-3xl text-white shadow-2xl shadow-[#137fec]/20 hover:shadow-[#137fec]/35 hover:scale-[1.01] transition-all text-left"
                        >
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0">
                                <Plus className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="font-black text-xl tracking-tight">Create New SOP</div>
                                <div className="text-white/60 font-medium mt-0.5">Start a voice interview with AI</div>
                            </div>
                            <ArrowRight className="w-5 h-5 ml-auto opacity-0 translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 mr-2" />
                        </button>
                    </div>
                ) : (
                    <div className="mb-12 p-6 bg-white/2 border border-white/6 rounded-3xl flex items-center gap-5">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Lock className="w-6 h-6 text-white/25" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white/50 text-sm">Viewer Account</h4>
                            <p className="text-xs text-white/25 mt-1">You can browse and execute SOPs. Contact your admin to request Creator access.</p>
                        </div>
                    </div>
                )}

                {/* Template Suggestions — only for Creators */}
                {isCreator && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
                                SOP Ideas for {SUPPORTED_INDUSTRIES[selectedIndustry].name}
                            </span>
                        </div>
                        <p className="text-white/25 text-xs mb-6">Common processes in your industry — click to start creating</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                    className="flex flex-col items-start gap-3 p-6 bg-white/3 border border-white/6 rounded-2xl hover:bg-white/6 hover:border-white/12 hover:-translate-y-0.5 transition-all text-left group"
                                >
                                    <div className="text-2xl">{template.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-white/80 group-hover:text-white transition-colors">{template.title}</h4>
                                        <p className="text-xs text-white/30 mt-1 leading-relaxed">{template.description}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {template.tags.map(tag => (
                                                <span key={tag} className="text-[10px] bg-[#137fec]/10 text-[#137fec]/70 px-2 py-0.5 rounded-full font-bold border border-[#137fec]/10">#{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* SOP List */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
                            Recent Documentation
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center py-24 opacity-30">
                            <Loader2Icon className="w-10 h-10 text-[#137fec] animate-spin mb-4" />
                            <span className="text-white font-medium">Loading your library...</span>
                        </div>
                    ) : filteredSops.length > 0 ? (
                        <div className="space-y-3">
                            {filteredSops.map((sop) => (
                                <div
                                    key={sop.id}
                                    className="bg-white/3 border border-white/6 p-5 rounded-2xl hover:bg-white/6 hover:border-white/12 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center gap-5 group"
                                    onClick={() => onViewSOP(sop)}
                                >
                                    <div className="relative w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white/30 group-hover:bg-[#137fec]/10 group-hover:text-[#137fec] transition-all flex-shrink-0">
                                        <FileText className="w-5 h-5" />
                                        {sop.version && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-[#137fec] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                                V{sop.version}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-white/80 truncate group-hover:text-white transition-colors">{sop.title}</h4>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-white/25 uppercase tracking-tight">
                                                <Globe2 className="w-3 h-3" />
                                                {sop.language}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-white/25 uppercase tracking-tight">
                                                <Clock className="w-3 h-3" />
                                                {new Date(sop.updated_at).toLocaleDateString()}
                                            </div>
                                            {sop.related_sop_ids && sop.related_sop_ids.length > 0 && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-[#137fec]/50 uppercase tracking-tight">
                                                    <Link2 className="w-3 h-3" />
                                                    {sop.related_sop_ids.length} linked
                                                </div>
                                            )}
                                            {sop.tags && sop.tags.slice(0, 2).map(tag => (
                                                <span key={tag} className="text-[10px] bg-[#137fec]/10 text-[#137fec]/60 px-2 py-0.5 rounded-full font-bold">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <button className="p-2 text-white/20 hover:text-white/50 transition-colors flex-shrink-0">
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        isCreator ? (
                            <button
                                onClick={onNewSOP}
                                className="w-full py-20 bg-white/2 hover:bg-white/4 transition-all rounded-3xl border border-dashed border-white/8 hover:border-white/15 cursor-pointer group"
                            >
                                <div className="w-16 h-16 bg-[#137fec]/8 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-[#137fec]/15 transition-all">
                                    <Plus className="w-8 h-8 text-[#137fec]/50 group-hover:text-[#137fec]/80 transition-colors" />
                                </div>
                                <h4 className="font-black text-lg text-white/40 group-hover:text-white/60 mb-2 transition-colors tracking-tight">Start your first SOP</h4>
                                <p className="text-white/25 text-sm px-10 max-w-sm mx-auto leading-relaxed">
                                    Documentation doesn't have to be a chore. Let our AI guide you through a voice interview.
                                </p>
                            </button>
                        ) : (
                            <div className="w-full py-20 bg-white/2 rounded-3xl border border-white/6 text-center">
                                <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
                                <h4 className="font-black text-lg text-white/30 mb-2 tracking-tight">No SOPs available yet</h4>
                                <p className="text-white/20 text-sm">Your team's SOPs will appear here once created.</p>
                            </div>
                        )
                    )}
                </div>
            </main>
        </div>
    );
}

function Loader2Icon({ className }: { className?: string }) {
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
