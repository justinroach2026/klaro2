import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { getProfile, updateProfile } from '../../lib/supabase';
import LanguageSelector from './steps/LanguageSelector';
import CountrySelector from './steps/CountrySelector';
import IndustrySelector from './steps/IndustrySelector';
import ResearchPanel from './steps/ResearchPanel';
import ModeSelector from './steps/ModeSelector';
import DriveMode from './DriveMode';
import OfficeMode from './OfficeMode';
import { X } from 'lucide-react';

type Step = 'language' | 'country' | 'industry' | 'research' | 'mode' | 'active';

export default function InterviewPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [step, setStep] = useState<Step>('language');
    const { user, setProfile, interviewMode } = useStore();

    // If navigated here with resumeSession flag, skip the wizard
    useEffect(() => {
        if (location.state?.resumeSession && interviewMode) {
            setStep('active');
        }
    }, []);

    const handleIndustryNext = async () => {
        if (user) {
            try {
                const { selectedIndustry, selectedCountry, selectedLanguage } = useStore.getState();
                await updateProfile(user.id, {
                    industry: selectedIndustry,
                    country: selectedCountry,
                    language_preference: selectedLanguage,
                });
                const updatedProfile = await getProfile(user.id);
                setProfile(updatedProfile);
            } catch (err) {
                console.error('Error saving profile:', err);
            }
        }
        setStep('research');
    };

    if (step === 'active') {
        return (
            <div className="fixed inset-0 z-50">
                {interviewMode === 'drive' ? <DriveMode /> : <OfficeMode />}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="fixed top-4 right-4 z-[60] flex items-center gap-1.5 px-3 py-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm rounded-xl text-gray-700 dark:text-white/80 font-medium text-sm transition-colors"
                >
                    <X className="w-4 h-4" />
                    Exit
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400 flex flex-col items-center justify-center p-6">
            <div className="relative w-full flex flex-col items-center">
                {step === 'language' && (
                    <>
                        <LanguageSelector />
                        <div className="w-full max-w-md mt-6 flex gap-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex-1 py-3.5 border border-white/40 rounded-xl text-white font-semibold hover:bg-white/10 transition-all text-sm backdrop-blur-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setStep('country')}
                                className="flex-1 py-3.5 rounded-xl bg-white hover:bg-white/90 text-[#137fec] font-bold text-sm tracking-wide transition-all shadow-lg"
                            >
                                Continue
                            </button>
                        </div>
                    </>
                )}

                {step === 'country' && (
                    <>
                        <CountrySelector />
                        <div className="w-full max-w-md mt-6 flex gap-3">
                            <button
                                onClick={() => setStep('language')}
                                className="flex-1 py-3.5 border border-white/40 rounded-xl text-white font-semibold hover:bg-white/10 transition-all text-sm backdrop-blur-sm"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep('industry')}
                                className="flex-1 py-3.5 rounded-xl bg-white hover:bg-white/90 text-[#137fec] font-bold text-sm tracking-wide transition-all shadow-lg"
                            >
                                Continue
                            </button>
                        </div>
                    </>
                )}

                {step === 'industry' && (
                    <>
                        <IndustrySelector />
                        <div className="w-full max-w-5xl mt-6 flex gap-3">
                            <button
                                onClick={() => setStep('country')}
                                className="flex-1 py-3.5 border border-white/40 rounded-xl text-white font-semibold hover:bg-white/10 transition-all text-sm backdrop-blur-sm"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleIndustryNext}
                                className="flex-1 py-3.5 rounded-xl bg-white hover:bg-white/90 text-[#137fec] font-bold text-sm tracking-wide transition-all shadow-lg"
                            >
                                Continue
                            </button>
                        </div>
                    </>
                )}

                {step === 'research' && (
                    <ResearchPanel
                        onBack={() => setStep('industry')}
                        onContinue={() => setStep('mode')}
                    />
                )}

                {step === 'mode' && (
                    <ModeSelector onContinue={() => setStep('active')} />
                )}
            </div>
        </div>
    );
}
