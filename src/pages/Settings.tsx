import { useState, useEffect, useRef } from 'react';
import { useStore, SUPPORTED_LANGUAGES, SUPPORTED_INDUSTRIES, SUPPORTED_COUNTRIES, type LanguageCode, type IndustryCode, type CountryCode } from '../store';
import { updateProfile, supabase } from '../lib/supabase';
import { ArrowLeft, Save, Globe, Building2, MapPin, Bot, CheckCircle2, Briefcase, Upload, Link, Mail, Phone, MapPinned, ImagePlus, Trash2, Loader2 } from 'lucide-react';

interface SettingsProps {
    onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
    const { user, profile, setProfile, selectedLanguage, selectedIndustry, selectedCountry, setSelectedLanguage, setSelectedIndustry, setSelectedCountry } = useStore();

    const [language, setLanguage] = useState<LanguageCode>(selectedLanguage);
    const [industry, setIndustry] = useState<IndustryCode>(selectedIndustry);
    const [country, setCountry] = useState<CountryCode>(selectedCountry);
    const [agenticPrompt, setAgenticPrompt] = useState<string>(profile?.agentic_prompt || '');

    // Company fields
    const [companyName, setCompanyName] = useState(profile?.company_name || '');
    const [companyLogoUrl, setCompanyLogoUrl] = useState(profile?.company_logo_url || '');
    const [companyWebsite, setCompanyWebsite] = useState(profile?.company_website || '');
    const [companyEmail, setCompanyEmail] = useState(profile?.company_email || '');
    const [companyPhone, setCompanyPhone] = useState(profile?.company_phone || '');
    const [companyAddress, setCompanyAddress] = useState(profile?.company_address || '');

    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isDraggingLogo, setIsDraggingLogo] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (profile) {
            if (profile.industry) setIndustry(profile.industry);
            if (profile.country) setCountry(profile.country);
            if (profile.language_preference) setLanguage(profile.language_preference as LanguageCode);
            if (profile.agentic_prompt) setAgenticPrompt(profile.agentic_prompt);
            if (profile.company_name) setCompanyName(profile.company_name);
            if (profile.company_logo_url) setCompanyLogoUrl(profile.company_logo_url);
            if (profile.company_website) setCompanyWebsite(profile.company_website);
            if (profile.company_email) setCompanyEmail(profile.company_email);
            if (profile.company_phone) setCompanyPhone(profile.company_phone);
            if (profile.company_address) setCompanyAddress(profile.company_address);
        }
    }, [profile]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        setSaved(false);
        try {
            const updated = await updateProfile(user.id, {
                language_preference: language,
                industry: industry,
                country: country,
                agentic_prompt: agenticPrompt || null,
                company_name: companyName || null,
                company_logo_url: companyLogoUrl || null,
                company_website: companyWebsite || null,
                company_email: companyEmail || null,
                company_phone: companyPhone || null,
                company_address: companyAddress || null,
            });

            setSelectedLanguage(language);
            setSelectedIndustry(industry);
            setSelectedCountry(country);
            setProfile({ ...profile, ...updated });

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Failed to save settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async (file: File) => {
        if (!user) return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (PNG, JPG, SVG, or WebP)');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Logo file must be under 2MB');
            return;
        }

        setIsUploadingLogo(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase!
                .storage
                .from('company-logos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = supabase!
                .storage
                .from('company-logos')
                .getPublicUrl(data.path);

            setCompanyLogoUrl(urlData.publicUrl);
        } catch (err: any) {
            console.error('Logo upload error:', err);
            alert('Failed to upload logo. Make sure the storage bucket exists. You can also paste a URL instead.');
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingLogo(false);
        const file = e.dataTransfer.files[0];
        if (file) handleLogoUpload(file);
    };

    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleLogoUpload(file);
    };

    const handleRemoveLogo = () => {
        setCompanyLogoUrl('');
    };

    const inputClass = "w-full p-3 border border-gray-200 rounded-xl text-sm text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all";

    return (
        <div className="min-h-screen bg-background-alt pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={onBack} className="flex items-center gap-2 text-text-light hover:text-text transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-bold">Back to Dashboard</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn-primary flex items-center gap-2 text-sm"
                    >
                        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-text">Settings</h1>
                    <p className="text-text-light mt-1">Manage your preferences. Changes will be used for all future SOP interviews.</p>
                </div>

                {/* Company Information */}
                <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-text">Company Information</h2>
                            <p className="text-xs text-text-lighter">Your business details appear on all SOP documents</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* Company Name */}
                        <div>
                            <label className="block text-sm font-semibold text-text mb-1.5 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-text-lighter" /> Company Name
                            </label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="e.g. Acme Corporation Ltd"
                                className={inputClass}
                            />
                        </div>

                        {/* Logo Upload */}
                        <div>
                            <label className="block text-sm font-semibold text-text mb-1.5 flex items-center gap-2">
                                <ImagePlus className="w-4 h-4 text-text-lighter" /> Company Logo
                            </label>

                            {companyLogoUrl ? (
                                <div className="mt-1 p-5 bg-background-alt rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={companyLogoUrl}
                                            alt="Company logo"
                                            className="h-16 max-w-[240px] object-contain rounded-lg"
                                            onError={(e) => {
                                                e.currentTarget.src = '';
                                                e.currentTarget.alt = 'Failed to load';
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-text-lighter truncate">{companyLogoUrl}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => logoInputRef.current?.click()}
                                                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <Upload className="w-3 h-3" /> Replace
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveLogo}
                                                    className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                                    onDragLeave={() => setIsDraggingLogo(false)}
                                    onDrop={handleLogoDrop}
                                    onClick={() => logoInputRef.current?.click()}
                                    className={`mt-1 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${isDraggingLogo
                                            ? 'border-primary bg-primary/5 scale-[1.01]'
                                            : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50'
                                        }`}
                                >
                                    {isUploadingLogo ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                            <p className="text-sm text-text-light font-medium">Uploading…</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                                                <ImagePlus className="w-6 h-6 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-text">Drop your logo here or click to upload</p>
                                                <p className="text-[11px] text-text-lighter mt-0.5">PNG, JPG, SVG, or WebP — max 2MB</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                onChange={handleLogoFileChange}
                                className="hidden"
                            />

                            {/* URL fallback option */}
                            <details className="mt-3">
                                <summary className="text-[11px] text-text-lighter cursor-pointer hover:text-primary transition-colors">Or paste a logo URL instead</summary>
                                <input
                                    type="url"
                                    value={companyLogoUrl}
                                    onChange={(e) => setCompanyLogoUrl(e.target.value)}
                                    placeholder="https://yourcompany.com/logo.png"
                                    className={`${inputClass} mt-2`}
                                />
                            </details>
                        </div>

                        {/* Two-column grid for contact details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-text mb-1.5 flex items-center gap-2">
                                    <Link className="w-4 h-4 text-text-lighter" /> Website
                                </label>
                                <input
                                    type="url"
                                    value={companyWebsite}
                                    onChange={(e) => setCompanyWebsite(e.target.value)}
                                    placeholder="https://www.yourcompany.com"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-text mb-1.5 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-text-lighter" /> Contact Email
                                </label>
                                <input
                                    type="email"
                                    value={companyEmail}
                                    onChange={(e) => setCompanyEmail(e.target.value)}
                                    placeholder="info@yourcompany.com"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-text mb-1.5 flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-text-lighter" /> Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={companyPhone}
                                    onChange={(e) => setCompanyPhone(e.target.value)}
                                    placeholder="+44 20 1234 5678"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-text mb-1.5 flex items-center gap-2">
                                    <MapPinned className="w-4 h-4 text-text-lighter" /> Business Address
                                </label>
                                <input
                                    type="text"
                                    value={companyAddress}
                                    onChange={(e) => setCompanyAddress(e.target.value)}
                                    placeholder="123 Business Street, London, EC1A 1BB"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Language */}
                <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-text">Language</h2>
                            <p className="text-xs text-text-lighter">Interview and SOP output language</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
                            <button
                                key={code}
                                onClick={() => setLanguage(code as LanguageCode)}
                                className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${language === code
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-100 hover:border-gray-200 text-text-light'
                                    }`}
                            >
                                {lang.nativeName}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Country */}
                <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-text">Country / Region</h2>
                            <p className="text-xs text-text-lighter">Affects regulatory research and legal compliance</p>
                        </div>
                    </div>
                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                        {(() => {
                            const regions: Record<string, [string, typeof SUPPORTED_COUNTRIES[keyof typeof SUPPORTED_COUNTRIES]][]> = {};
                            for (const [code, c] of Object.entries(SUPPORTED_COUNTRIES)) {
                                const region = c.region;
                                if (!regions[region]) regions[region] = [];
                                regions[region].push([code, c]);
                            }
                            const regionOrder = ['Europe', 'Middle East', 'Africa', 'Americas', 'Asia-Pacific'];
                            return regionOrder.filter(r => regions[r]).map((region) => (
                                <div key={region}>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-lighter mb-2">{region}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {regions[region].map(([code, c]) => (
                                            <button
                                                key={code}
                                                onClick={() => setCountry(code as CountryCode)}
                                                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${country === code
                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                                                    : 'border-gray-100 hover:border-gray-200 text-text-light'
                                                    }`}
                                            >
                                                <span className="text-lg">{c.flag}</span>
                                                <span className="truncate">{c.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </section>

                {/* Industry */}
                <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-text">Industry</h2>
                            <p className="text-xs text-text-lighter">Tailors AI suggestions and research to your sector</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(SUPPORTED_INDUSTRIES).map(([code, ind]) => (
                            <button
                                key={code}
                                onClick={() => setIndustry(code as IndustryCode)}
                                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${industry === code
                                    ? 'border-emerald-600 bg-emerald-50'
                                    : 'border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                <span className={`font-bold text-sm ${industry === code ? 'text-emerald-700' : 'text-text'}`}>{ind.name}</span>
                                <span className="text-xs text-text-lighter mt-0.5">{ind.description}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Agentic Prompt */}
                <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-text">Custom AI Instructions</h2>
                            <p className="text-xs text-text-lighter">Optional. Override the default interviewer behaviour with your own instructions.</p>
                        </div>
                    </div>
                    <textarea
                        value={agenticPrompt}
                        onChange={(e) => setAgenticPrompt(e.target.value)}
                        rows={6}
                        placeholder="e.g. Always ask about safety procedures first. Focus on compliance with ISO 9001. Use British English spelling..."
                        className="w-full p-4 border border-gray-200 rounded-xl text-sm text-text focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none transition-all resize-none"
                    />
                    <p className="text-[11px] text-text-lighter mt-2">
                        This prompt will be prepended to every AI interview session. Leave blank to use the default Klaro interviewer.
                    </p>
                </section>

                {/* Bottom Save Button */}
                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 text-base font-bold"
                    >
                        {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                        {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save All Changes'}
                    </button>
                </div>
            </main>
        </div>
    );
}
