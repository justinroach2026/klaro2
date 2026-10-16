import { formatClock } from './limits';

export interface VideoSOP {
    title: string;
    purpose: string;
    roles: string[];
    prerequisites: string[];
    steps: { timestampSeconds: number; title: string; instruction: string; notes?: string }[];
    qualityStandards: string[];
    tips: string[];
    troubleshooting: string[];
}

export const SOP_IMAGE_SCHEME = 'sop-image://';

const bullets = (items: string[]) => items.map(i => `- ${i}`).join('\n');

/**
 * Builds the SOP markdown in the Klaro SOP Standard layout (same headings as generateBestPracticeSOP).
 * `imagePaths[i]` is the storage path of step i's screenshot, or null if none could be captured.
 */
export function composeSopMarkdown(sop: VideoSOP, imagePaths: (string | null)[]): string {
    const sections: string[] = [`# ${sop.title}`];
    const add = (heading: string, body: string) => { if (body.trim()) sections.push(`## ${heading}\n\n${body}`); };

    add('📝 Purpose', sop.purpose);
    add('👥 Roles & Responsibilities', bullets(sop.roles));
    add('🛠 Prerequisites & Tools', bullets(sop.prerequisites));

    add('🏁 Step-by-Step Procedure', sop.steps.map((step, i) => {
        const lines = [`### ${i + 1}. ${step.title} · ${formatClock(step.timestampSeconds)}`, '', step.instruction];
        if (step.notes) lines.push('', `> ${step.notes}`);
        if (imagePaths[i]) lines.push('', `![Step ${i + 1}: ${step.title.replace(/[[\]]/g, '')}](${SOP_IMAGE_SCHEME}${imagePaths[i]})`);
        return lines.join('\n');
    }).join('\n\n'));

    add('🎯 Quality Standards', bullets(sop.qualityStandards));
    add('💡 Pro Tips & Best Practices', bullets(sop.tips));
    add('⚠️ Common Issues & Troubleshooting', bullets(sop.troubleshooting));

    return sections.join('\n\n') + '\n';
}
