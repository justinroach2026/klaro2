import { supabase } from './supabase';

// Client side of the review workflow. The rules themselves live in the database
// (supabase/migrations/20261016_manager_review.sql); these helpers only call them.

export type ApprovalStatus = 'approved' | 'pending' | 'changes_requested';

export interface WorkflowFields {
    owner_id?: string | null;
    created_by?: string | null;
    approval_status?: ApprovalStatus;
    pending_title?: string | null;
    pending_content?: string | null;
    pending_by?: string | null;
    pending_at?: string | null;
    review_note?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    review_interval_days?: number | null;
    last_reviewed_at?: string | null;
    next_review_at?: string | null;
}

export interface TeamMember {
    id: string;
    full_name: string | null;
    email: string | null;
    role: 'creator' | 'viewer';
    manager_id: string | null;
}

export interface TeamInvite {
    id: string;
    email: string;
    role: 'creator' | 'viewer';
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
}

export interface AuditEntry {
    seq: number;
    sop_id: string;
    sop_title: string | null;
    actor_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    action: string;
    at: string;
    from_version: number | null;
    to_version: number | null;
    summary: string | null;
    before_title: string | null;
    after_title: string | null;
    before_content: string | null;
    after_content: string | null;
    note: string | null;
    entry_hash: string;
}

// The sops table now has several links to profiles; name the author one explicitly.
export const SOP_SELECT = '*, profiles:profiles!created_by(full_name)';

function db() {
    if (!supabase) throw new Error('Supabase not initialized');
    return supabase;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await db().rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
}

// ─── SOP workflow ────────────────────────────────────────────────────────────

export const saveSopEdit = <T>(sopId: string, title: string, content: string, opts?: { summary?: string; restore?: boolean }) =>
    rpc<T>('save_sop_edit', {
        p_sop: sopId,
        p_title: title,
        p_content: content,
        p_summary: opts?.summary ?? null,
        p_restore: opts?.restore ?? false,
    });

export const approveSop = <T>(sopId: string) => rpc<T>('approve_sop', { p_sop: sopId });
export const requestSopChanges = <T>(sopId: string, note: string) => rpc<T>('request_sop_changes', { p_sop: sopId, p_note: note });
export const claimSop = <T>(sopId: string) => rpc<T>('claim_sop', { p_sop: sopId });
export const markSopReviewed = <T>(sopId: string) => rpc<T>('mark_sop_reviewed', { p_sop: sopId });

export const fetchSop = async <T>(sopId: string): Promise<T> => {
    const { data, error } = await db().from('sops').select(SOP_SELECT).eq('id', sopId).single();
    if (error) throw new Error(error.message);
    return data as T;
};

export const hasPendingRevision = (s: WorkflowFields) => s.pending_content != null || s.pending_title != null;
export const isReviewOverdue = (s: WorkflowFields) => !!s.next_review_at && new Date(s.next_review_at).getTime() < Date.now();

/** Whether `userId` may claim an unowned SOP: the author's manager, or the author if they have none. */
export const canClaim = (s: WorkflowFields, userId: string | undefined, members: TeamMember[]) => {
    if (!userId || s.owner_id) return false;
    const author = members.find(m => m.id === s.created_by);
    if (!s.created_by) return members.find(m => m.id === userId)?.role === 'creator';
    if (author?.manager_id) return author.manager_id === userId;
    return s.created_by === userId;
};

// ─── Team ────────────────────────────────────────────────────────────────────

export const getTeamMembers = async (): Promise<TeamMember[]> => {
    const { data, error } = await db()
        .from('profiles')
        .select('id, full_name, email, role, manager_id')
        .order('full_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as TeamMember[];
};

export const memberName = (m: Pick<TeamMember, 'full_name' | 'email'> | null | undefined, fallback = 'a team member') =>
    m?.full_name?.trim() || m?.email || fallback;

export const setManager = async (userId: string, managerId: string | null) => {
    const { error } = await db().from('profiles').update({ manager_id: managerId }).eq('id', userId);
    if (error) throw new Error(error.message);
};

export const createTeamInvite = (email: string, role: 'creator' | 'viewer') =>
    rpc<string>('create_team_invite', { p_email: email, p_role: role });

export const inviteLink = (token: string) => `${window.location.origin}/join?token=${encodeURIComponent(token)}`;

export const listTeamInvites = async (): Promise<TeamInvite[]> => {
    const { data, error } = await db()
        .from('team_invites')
        .select('id, email, role, created_at, expires_at, accepted_at, revoked_at')
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TeamInvite[];
};

export const revokeTeamInvite = (inviteId: string) => rpc<void>('revoke_team_invite', { p_invite: inviteId });
export const acceptTeamInvite = (token: string) => rpc<string>('accept_team_invite', { p_token: token });

// ─── Audit trail ─────────────────────────────────────────────────────────────

export const AUDIT_ACTION_LABELS: Record<string, string> = {
    audit_started: 'Audit trail started',
    created: 'Created (draft)',
    published: 'Published',
    submitted_for_approval: 'Submitted for approval',
    approved: 'Approved',
    claimed: 'Claimed and approved',
    edited: 'Edited',
    restored: 'Restored a previous version',
    resubmitted: 'Changed and resubmitted',
    revision_submitted: 'Revision submitted',
    revision_resubmitted: 'Revision updated',
    revision_approved: 'Revision approved',
    changes_requested: 'Changes requested',
    review_completed: 'Review completed',
    review_schedule_changed: 'Review schedule changed',
    details_changed: 'Details changed',
    moved_team: 'Moved team',
    deleted: 'Deleted',
};

export const getAuditLog = async (sopId: string): Promise<AuditEntry[]> => {
    const { data, error } = await db()
        .from('sop_audit_log')
        .select('*')
        .eq('sop_id', sopId)
        .order('seq', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AuditEntry[];
};

export const verifySopAudit = async (sopId: string) => {
    const rows = await rpc<{ ok: boolean; entries: number; first_bad_seq: number | null }[]>('verify_sop_audit', { p_sop: sopId });
    return rows[0] ?? { ok: true, entries: 0, first_bad_seq: null };
};

const csvCell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const auditToCsv = (entries: AuditEntry[]) => {
    const header = ['Sequence', 'Date and time (UTC)', 'Action', 'By', 'Email', 'Summary', 'Note', 'From version', 'To version',
        'Title before', 'Title after', 'Content before', 'Content after', 'Entry hash'];
    const rows = [...entries].sort((a, b) => a.seq - b.seq).map(e => [
        e.seq, new Date(e.at).toISOString(), AUDIT_ACTION_LABELS[e.action] ?? e.action, e.actor_name, e.actor_email,
        e.summary, e.note, e.from_version, e.to_version, e.before_title, e.after_title, e.before_content, e.after_content, e.entry_hash,
    ]);
    return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
};

export const downloadText = (filename: string, text: string, type = 'text/csv') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

// ─── Line diff (for "what changed") ──────────────────────────────────────────

export type DiffLine = { type: 'same' | 'add' | 'del'; text: string };

/** LCS line diff; falls back to "all removed / all added" for very large inputs. */
export function lineDiff(before: string, after: string): DiffLine[] {
    const a = before.split('\n');
    const b = after.split('\n');
    if (a.length * b.length > 4_000_000) {
        return [...a.map(text => ({ type: 'del' as const, text })), ...b.map(text => ({ type: 'add' as const, text }))];
    }
    const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    const out: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++; }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i++; }
        else { out.push({ type: 'add', text: b[j] }); j++; }
    }
    while (i < a.length) out.push({ type: 'del', text: a[i++] });
    while (j < b.length) out.push({ type: 'add', text: b[j++] });
    return out;
}

// ─── Pending invite across sign-in / sign-up ─────────────────────────────────
// A signed-out invitee is sent to sign in (or confirm their email) first; the token waits here.

const PENDING_INVITE_KEY = 'klaro.pendingInvite';

export const rememberInvite = (token: string) => {
    try { localStorage.setItem(PENDING_INVITE_KEY, token); } catch { /* storage unavailable */ }
};

export const forgetInvite = () => {
    try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* storage unavailable */ }
};

/** Where to go after signing in: back to a pending invite if there is one. */
export const postAuthPath = () => {
    try {
        const token = localStorage.getItem(PENDING_INVITE_KEY);
        if (token) return `/join?token=${encodeURIComponent(token)}`;
    } catch { /* storage unavailable */ }
    return '/dashboard';
};
