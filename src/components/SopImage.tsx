import { useEffect, useState, type ComponentProps } from 'react';
import { getSopImageUrl } from '../lib/video/images';
import { SOP_IMAGE_SCHEME } from '../lib/video/compose';

/**
 * Renders `sop-image://<storage path>` markdown images by resolving them to short-lived signed URLs.
 * Plain http(s) images pass through untouched.
 */
export default function SopMarkdownImage({ src, alt }: ComponentProps<'img'>) {
    const isStored = typeof src === 'string' && src.startsWith(SOP_IMAGE_SCHEME);
    const [resolved, setResolved] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!isStored) return;
        let cancelled = false;
        getSopImageUrl(src.slice(SOP_IMAGE_SCHEME.length)).then(url => {
            if (cancelled) return;
            if (url) setResolved(url); else setFailed(true);
        });
        return () => { cancelled = true; };
    }, [src, isStored]);

    if (!isStored) return <img src={src} alt={alt ?? ''} />;
    if (failed) return <span className="text-xs text-gray-400 italic">[screenshot unavailable]</span>;
    if (!resolved) return <span className="block h-32 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />;
    return <img src={resolved} alt={alt ?? ''} className="rounded-xl border border-gray-200 dark:border-white/10 shadow-sm" loading="lazy" />;
}
