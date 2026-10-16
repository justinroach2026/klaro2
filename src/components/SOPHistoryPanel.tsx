import { useEffect, useState } from 'react';
import { getSOPHistory } from '../lib/supabase';
import {
    getAuditLog, verifySopAudit, auditToCsv, downloadText, lineDiff, AUDIT_ACTION_LABELS,
    type AuditEntry, type DiffLine,
} from '../lib/review';
import { X, Clock, History, Eye, RotateCcw, ScrollText, Download, ShieldCheck, ShieldAlert, ChevronDown, ChevronRight } from 'lucide-react';

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
    sopTitle: string;
    isOpen: boolean;
    onClose: () => void;
    currentRole: 'creator' | 'viewer';
    onViewVersion: (record: HistoryRecord) => void;
    onRestoreVersion?: (record: HistoryRecord) => void;
}

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Changed lines with two lines of context; long unchanged stretches collapse to "…". */
function compactDiff(lines: DiffLine[], context = 2): (DiffLine | null)[] {
    const keep = new Set<number>();
    lines.forEach((l, i) => {
        if (l.type !== 'same') for (let k = i - context; k <= i + context; k++) keep.add(k);
    });
    const out: (DiffLine | null)[] = [];
    lines.forEach((l, i) => {
        if (keep.has(i)) out.push(l);
        else if (out[out.length - 1] !== null) out.push(null);
    });
    return out;
}

function ChangeDetails({ entry }: { entry: AuditEntry }) {
    const titleChanged = entry.before_title != null && entry.after_title != null && entry.before_title !== entry.after_title;
    const hasDiff = entry.before_content != null && entry.after_content != null;
    const fullText = entry.before_content == null ? entry.after_content : null;

    return (
        <div className="mt-3 space-y-2">
            {titleChanged && (
                <p className="text-xs text-white/60">
                    Title: <span className="line-through text-red-300">{entry.before_title}</span> → <span className="text-green-300">{entry.after_title}</span>
                </p>
            )}
            {hasDiff && (
                <pre className="text-[11px] leading-relaxed font-mono bg-black/30 rounded-xl p-3 overflow-x-auto max-h-80 whitespace-pre-wrap break-words">
                    {compactDiff(lineDiff(entry.before_content!, entry.after_content!)).map((l, i) =>
                        l === null
                            ? <div key={i} className="text-white/25">⋯</div>
                            : <div key={i} className={l.type === 'add' ? 'bg-green-500/15 text-green-200' : l.type === 'del' ? 'bg-red-500/15 text-red-200 line-through' : 'text-white/40'}>
                                {l.type === 'add' ? '+ ' : l.type === 'del' ? '− ' : '  '}{l.text || ' '}
                            </div>
                    )}
                </pre>
            )}
            {fullText != null && (
                <pre className="text-[11px] leading-relaxed font-mono bg-black/30 rounded-xl p-3 overflow-x-auto max-h-80 whitespace-pre-wrap break-words text-white/60">
                    {fullText}
                </pre>
            )}
        </div>
    );
}

export default function SOPHistoryPanel({
    sopId,
    sopTitle,
    isOpen,
    onClose,
    currentRole,
    onViewVersion,
    onRestoreVersion
}: SOPHistoryPanelProps) {
    const [tab, setTab] = useState<'audit' | 'versions'>('audit');
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [audit, setAudit] = useState<AuditEntry[]>([]);
    const [chain, setChain] = useState<{ ok: boolean; entries: number; first_bad_seq: number | null } | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        Promise.all([getSOPHistory(sopId), getAuditLog(sopId), verifySopAudit(sopId)])
            .then(([h, a, c]) => {
                setHistory(h as HistoryRecord[]);
                setAudit(a);
                setChain(c);
                setError(null);
            })
            .catch(err => setError(err instanceof Error ? err.message : 'Could not load history'))
            .finally(() => setLoaded(true));
    }, [isOpen, sopId]);

    const isLoading = !loaded;

    // Reset on close so the next open shows fresh data, not the previous SOP's.
    const handleClose = () => {
        setLoaded(false);
        setExpanded(new Set());
        onClose();
    };

    const toggle = (seq: number) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(seq)) next.delete(seq); else next.add(seq);
        return next;
    });

    const exportCsv = () => {
        const slug = sopTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'sop';
        downloadText(`${slug}-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`, auditToCsv(audit));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative w-full max-w-lg bg-[#121214] border-l border-white/10 h-full shadow-2xl flex flex-col animate-slide-in-right">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-10 h-10 bg-[#137fec]/10 rounded-xl flex items-center justify-center">
                            <History className="w-5 h-5 text-[#137fec]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight">History</h2>
                            <p className="text-xs text-white/30">Every change, who made it and when</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 text-white/30 hover:bg-white/5 hover:text-white rounded-xl transition-all" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 pt-4 flex items-center gap-2">
                    {(['audit', 'versions'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-[#137fec] text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}
                        >
                            {t === 'audit' ? `Audit trail (${audit.length})` : `Versions (${history.length})`}
                        </button>
                    ))}
                    {tab === 'audit' && audit.length > 0 && (
                        <button onClick={exportCsv} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-white/70 hover:text-white flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/30">
                            <Clock className="w-8 h-8 animate-pulse mb-3 text-[#137fec]" />
                            <p className="text-sm font-bold">Loading history...</p>
                        </div>
                    ) : error ? (
                        <p className="text-sm text-red-300">{error}</p>
                    ) : tab === 'audit' ? (
                        <div className="space-y-4">
                            {chain && audit.length > 0 && (
                                <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${chain.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/15 text-red-200'}`}>
                                    {chain.ok ? <ShieldCheck className="w-4 h-4 flex-shrink-0" /> : <ShieldAlert className="w-4 h-4 flex-shrink-0" />}
                                    <span>
                                        {chain.ok
                                            ? `Integrity check passed: all ${chain.entries} entries are intact and in order.`
                                            : `Integrity check FAILED at entry #${chain.first_bad_seq}: the record has been altered or an entry removed. Keep your exported copies.`}
                                    </span>
                                </div>
                            )}
                            {audit.length === 0 ? (
                                <div className="flex flex-col items-center text-center text-white/30 py-16 space-y-3">
                                    <ScrollText className="w-8 h-8 opacity-30" />
                                    <p className="font-bold text-sm">No audit entries yet.</p>
                                </div>
                            ) : audit.map(entry => {
                                const canExpand = entry.after_content != null || (entry.before_title != null && entry.after_title != null);
                                const isOpenEntry = expanded.has(entry.seq);
                                return (
                                    <div key={entry.seq} className="relative pl-6 border-l border-[#137fec]/20 pb-1">
                                        <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 bg-[#121214] border-2 border-[#137fec] rounded-full" />
                                        <div className="bg-white/3 border border-white/5 rounded-2xl p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="font-bold text-sm text-white">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</p>
                                                {(entry.from_version != null || entry.to_version != null) && entry.from_version !== entry.to_version && (
                                                    <span className="text-[10px] font-black bg-[#137fec]/15 text-[#137fec] px-2 py-0.5 rounded-md whitespace-nowrap">
                                                        {entry.from_version != null ? `v${entry.from_version} → ` : ''}v{entry.to_version ?? '–'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-white/50 mt-1">
                                                <time dateTime={entry.at}>{fmtDateTime(entry.at)}</time>
                                                {' · '}{entry.actor_name ?? 'Unknown'}
                                                {entry.actor_email && entry.actor_email !== entry.actor_name && <span className="text-white/30"> ({entry.actor_email})</span>}
                                            </p>
                                            {entry.summary && <p className="text-xs text-white/70 mt-2">{entry.summary}</p>}
                                            {entry.note && <p className="text-xs italic text-amber-200/90 mt-2">“{entry.note}”</p>}
                                            {canExpand && (
                                                <button onClick={() => toggle(entry.seq)} className="mt-2 text-[11px] font-bold text-[#137fec] flex items-center gap-1">
                                                    {isOpenEntry ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                    {entry.before_content != null ? 'What changed' : 'Text at this point'}
                                                </button>
                                            )}
                                            {isOpenEntry && <ChangeDetails entry={entry} />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-white/30 space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center">
                                <History className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="font-bold text-sm">No previous versions found.<br />Every approved change keeps a snapshot here.</p>
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
                                                {fmtDateTime(record.created_at)}
                                            </span>
                                        </div>

                                        <h4 className="font-bold text-white mb-1">{record.title}</h4>
                                        <p className="text-xs text-white/40 mb-3">Replaced by {record.profiles?.full_name || 'Unknown User'}</p>

                                        {record.change_summary && (
                                            <p className="text-sm py-2 px-3 bg-white/5 rounded-lg text-white/60 mb-4 italic">
                                                "{record.change_summary}"
                                            </p>
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    onViewVersion(record);
                                                    handleClose();
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
                                                        handleClose();
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

                <div className="p-4 border-t border-white/5 text-[10px] text-white/25 uppercase tracking-widest font-bold text-center">
                    Append-only audit trail · entries can't be edited or deleted
                </div>
            </div>
        </div>
    );
}
