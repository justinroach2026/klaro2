import { useEffect, useState } from 'react';
import { getSOPHistory } from '../lib/supabase';
import { X, Clock, History, Eye, RotateCcw } from 'lucide-react';

interface HistoryRecord {
    id: string;
    version: number;
    title: string;
    content: string;
    change_summary: string | null;
    created_at: string;
    created_by: string | null;
    profiles?: { full_name: string };
}

interface SOPHistoryPanelProps {
    sopId: string;
    isOpen: boolean;
    onClose: () => void;
    currentRole: 'creator' | 'viewer';
    onViewVersion: (record: HistoryRecord) => void;
    onRestoreVersion?: (record: HistoryRecord) => void;
}

export default function SOPHistoryPanel({ 
    sopId, 
    isOpen, 
    onClose, 
    currentRole,
    onViewVersion,
    onRestoreVersion
}: SOPHistoryPanelProps) {
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, sopId]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const data = await getSOPHistory(sopId);
            setHistory(data as HistoryRecord[]);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-[#121214] border-l border-white/10 h-full shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-10 h-10 bg-[#137fec]/10 rounded-xl flex items-center justify-center">
                            <History className="w-5 h-5 text-[#137fec]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight">Version History</h2>
                            <p className="text-xs text-white/30">Past edits and changes</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/30 hover:bg-white/5 hover:text-white rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/30">
                            <Clock className="w-8 h-8 animate-pulse mb-3 text-[#137fec]" />
                            <p className="text-sm font-bold">Loading history...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-white/30 space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center">
                                <History className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="font-bold text-sm">No previous versions found.<br />Every edit creates a new snapshot.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {history.map((record) => (
                                <div key={record.id} className="relative pl-6 border-l border-[#137fec]/20 pb-2">
                                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 bg-[#121214] border-2 border-[#137fec] rounded-full" />

                                    <div className="bg-white/3 border border-white/5 rounded-2xl p-5 hover:bg-white/5 transition-all group">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black bg-[#137fec]/15 text-[#137fec] px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                                Version {record.version}
                                            </span>
                                            <span className="text-[10px] font-bold text-white/30 flex items-center gap-1.5 uppercase tracking-wider">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(record.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <h4 className="font-bold text-white mb-1">{record.title}</h4>
                                        <p className="text-xs text-white/40 mb-3">By {record.profiles?.full_name || 'Unknown User'}</p>
                                        
                                        {record.change_summary && (
                                            <p className="text-sm py-2 px-3 bg-white/5 rounded-lg text-white/60 mb-4 italic">
                                                "{record.change_summary}"
                                            </p>
                                        )}

                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => {
                                                    onViewVersion(record);
                                                    onClose();
                                                }}
                                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                View
                                            </button>
                                            
                                            {currentRole === 'creator' && onRestoreVersion && (
                                                <button 
                                                    onClick={() => {
                                                        onRestoreVersion(record);
                                                        onClose();
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-[#137fec]/10 hover:bg-[#137fec]/20 text-[#137fec] text-xs font-bold transition-all flex items-center gap-1.5"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    Restore
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 text-[10px] text-white/20 uppercase tracking-widest font-bold text-center">
                    ISO 9001 Compliant Audit Trail
                </div>
            </div>
        </div>
    );
}
