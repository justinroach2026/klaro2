import ReactMarkdown from 'react-markdown';
import { Shield } from 'lucide-react';

interface PDFRendererProps {
    title: string;
    content: string;
    companyName?: string;
    companyLogoUrl?: string;
    version?: number;
    updatedAt: string;
    tags?: string[];
}

export default function PDFRenderer({
    title,
    content,
    companyName,
    companyLogoUrl,
    version,
    updatedAt,
    tags
}: PDFRendererProps) {
    return (
        <div className="hidden print:block font-sans text-black bg-white min-h-screen">
            {/* Header */}
            <header className="border-b-2 border-gray-200 pb-6 mb-8 flex items-start justify-between">
                <div>
                    {companyLogoUrl && (
                        <img 
                            src={companyLogoUrl} 
                            alt={`${companyName} Logo`} 
                            className="h-10 mb-4 object-contain"
                        />
                    )}
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">
                        {title}
                    </h1>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 font-bold uppercase tracking-wider">
                        {companyName && <span>{companyName}</span>}
                        {companyName && <span>•</span>}
                        <span>Standard Operating Procedure</span>
                    </div>
                </div>
                
                {/* Meta block */}
                <div className="text-right text-xs bg-gray-50 border border-gray-200 p-4 rounded-xl">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-left">
                        <span className="text-gray-500 font-bold uppercase tracking-widest">Version</span>
                        <span className="font-bold text-gray-900 text-right">{version ? `v${version}` : '1.0'}</span>
                        
                        <span className="text-gray-500 font-bold uppercase tracking-widest">Last Updated</span>
                        <span className="font-bold text-gray-900 text-right">{new Date(updatedAt).toLocaleDateString()}</span>
                        
                        <span className="text-gray-500 font-bold uppercase tracking-widest">Status</span>
                        <span className="font-bold text-green-600 flex items-center justify-end gap-1">
                            <Shield className="w-3 h-3" /> Approved
                        </span>
                    </div>
                </div>
            </header>

            {/* Content Body */}
            <main className="prose prose-sm prose-gray max-w-none">
                <ReactMarkdown
                    components={{
                        h1: ({ children }) => <h1 className="text-2xl font-black mt-10 mb-4 text-gray-900 pb-2 border-b border-gray-100">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold mt-6 mb-3 text-gray-800">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc pl-5 my-4 space-y-2 text-gray-700">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 my-4 space-y-2 text-gray-700">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                        blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-blue-500 bg-blue-50 p-4 my-6 rounded-r-lg text-gray-800 italic">
                                {children}
                            </blockquote>
                        ),
                        code: ({ node, inline, className, children, ...props }: any) => {
                            if (inline) {
                                return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600 font-mono text-sm" {...props}>{children}</code>;
                            }
                            return (
                                <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 my-6 overflow-x-auto text-sm font-mono text-gray-800">
                                    <code {...props}>{children}</code>
                                </pre>
                            );
                        },
                    }}
                >
                    {content}
                </ReactMarkdown>
            </main>

            {/* Footer */}
            {tags && tags.length > 0 && (
                <div className="mt-12 pt-6 border-t border-gray-200">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">Tags & Classification</p>
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-bold">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="fixed bottom-0 inset-x-0 pb-4 pt-4 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                Generated by Klaro Process Integrity Platform • {new Date().toLocaleDateString()}
            </div>
            
            {/* Forced page breaks for printing */}
            <style>
                {`
                    @media print {
                        @page { margin: 1.5cm; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        h1, h2, h3 { page-break-after: avoid; }
                        img { page-break-inside: avoid; }
                        pre, blockquote { page-break-inside: avoid; }
                        ul, ol { page-break-inside: avoid; }
                    }
                `}
            </style>
        </div>
    );
}
