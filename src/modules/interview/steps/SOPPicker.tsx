import { useState } from 'react';
import { useStore, SUPPORTED_INDUSTRIES } from '../../../store';
import { INDUSTRY_TEMPLATES, type SOPTemplate } from '../../../lib/templates';
import { Search } from 'lucide-react';

export default function SOPPicker() {
    const { selectedIndustry, selectedSOPTemplate, setSelectedSOPTemplate } = useStore();
    const [search, setSearch] = useState('');

    const templates = INDUSTRY_TEMPLATES[selectedIndustry] ?? [];
    const industryName = SUPPORTED_INDUSTRIES[selectedIndustry]?.name ?? 'Your Industry';

    const filtered = search.trim()
        ? templates.filter(
              (t) =>
                  t.title.toLowerCase().includes(search.toLowerCase()) ||
                  t.description.toLowerCase().includes(search.toLowerCase()) ||
                  t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
          )
        : templates;

    const handleSelect = (template: SOPTemplate) => {
        setSelectedSOPTemplate(selectedSOPTemplate?.title === template.title ? null : template);
    };

    return (
        <div className="w-full max-w-3xl">
            <div className="mb-5">
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow">
                    Where would you like to start?
                </h2>
                <p className="text-white/80 text-sm mt-1 drop-shadow">
                    Pick an SOP from the {industryName} playbook — or skip to document your own process.
                </p>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search SOPs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-sm text-gray-800 placeholder-gray-400 border border-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
                />
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin">
                {filtered.length === 0 && (
                    <p className="text-white/70 text-sm text-center py-6">No SOPs match your search.</p>
                )}
                {filtered.map((template) => {
                    const isSelected = selectedSOPTemplate?.title === template.title;
                    return (
                        <button
                            key={template.title}
                            onClick={() => handleSelect(template)}
                            className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                                isSelected
                                    ? 'border-[#137fec] bg-white shadow-lg shadow-[#137fec]/20'
                                    : 'border-white/40 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-white'
                            }`}
                        >
                            <span className="text-xl mt-0.5 flex-shrink-0">{template.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className={`font-bold text-sm ${
                                            isSelected ? 'text-[#137fec]' : 'text-gray-800'
                                        }`}
                                    >
                                        {template.title}
                                    </span>
                                    <div className="flex gap-1 flex-wrap">
                                        {template.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                    isSelected
                                                        ? 'bg-[#137fec]/10 text-[#137fec]'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                    {template.description}
                                </p>
                            </div>
                            {isSelected && (
                                <span className="text-[#137fec] font-bold text-xs flex-shrink-0 mt-0.5">
                                    ✓ Selected
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {selectedSOPTemplate && (
                <p className="text-white/90 text-xs text-center mt-3 font-medium drop-shadow">
                    "{selectedSOPTemplate.title}" selected — the AI will use this as your starting point.
                </p>
            )}
        </div>
    );
}
