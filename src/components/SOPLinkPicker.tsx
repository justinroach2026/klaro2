import { useState, useEffect } from 'react';
import { supabase, updateSOPRelatedIds } from '../lib/supabase';
import { Search, Link2, X, Check, FileText, Loader2 } from 'lucide-react';

interface SOPLinkPickerProps {
    sopId: string;
    currentRelatedIds: string[];
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (newIds: string[]) => void;
}

interface SOPOption {
    id: string;
    title: string;
    updated_at: string;
    version: number;
    language: string;
}

export default function SOPLinkPicker({ sopId, currentRelatedIds, isOpen, onClose, onUpdate }: SOPLinkPickerProps) {
    const [allSOPs, setAllSOPs] = useState<SOPOption[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentRelatedIds));
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedIds(new Set(currentRelatedIds));
        fetchSOPs();
    }, [isOpen]);

    const fetchSOPs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase!
                .from('sops')
                .select('id, title, updated_at, version, language')
                .neq('id', sopId) // exclude self
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setAllSOPs(data || []);
        } catch (err) {
            console.error('Failed to fetch SOPs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filtered = allSOPs.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const newIds = Array.from(selectedIds);
            await updateSOPRelatedIds(sopId, newIds);
            onUpdate(newIds);
            onClose();
        } catch (err) {
            console.error('Failed to save related SOPs:', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const hasChanges = (() => {
        const current = new Set(currentRelatedIds);
        if (current.size !== selectedIds.size) return true;
        for (const id of selectedIds) {
            if (!current.has(id)) return true;
        }
        return false;
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-[#121214] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#137fec]/10 rounded-xl flex items-center justify-center">
                            <Link2 className="w-5 h-5 text-[#137fec]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white tracking-tight">Link Related SOPs</h3>
                            <p className="text-xs text-white/30">Select SOPs that this process depends on</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search your SOPs…"
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#137fec]/40 focus:ring-1 focus:ring-[#137fec]/20 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* SOP List */}
                <div className="max-h-[50vh] overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-[#137fec] animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-8 h-8 text-white/15 mx-auto mb-3" />
                            <p className="text-sm text-white/30 font-medium">
                                {searchQuery ? 'No SOPs match your search' : 'No other SOPs found'}
                            </p>
                        </div>
                    ) : (
                        filtered.map(sop => {
                            const isSelected = selectedIds.has(sop.id);
                            return (
                                <button
                                    key={sop.id}
                                    onClick={() => toggleSelect(sop.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 text-left transition-all ${
                                        isSelected
                                            ? 'bg-[#137fec]/10 border border-[#137fec]/30'
                                            : 'hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        isSelected
                                            ? 'bg-[#137fec] border-[#137fec]'
                                            : 'border-white/15'
                                    }`}>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                            {sop.title}
                                        </p>
                                        <p className="text-[10px] text-white/25 font-bold uppercase tracking-tight mt-0.5">
                                            V{sop.version} · {sop.language.toUpperCase()} · {new Date(sop.updated_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-white/5">
                    <span className="text-xs text-white/30 font-bold">
                        {selectedIds.size} linked
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm font-bold hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className="px-5 py-2.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                            {isSaving ? 'Saving…' : 'Save Links'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
