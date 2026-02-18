import { useStore } from '../store';
import { Sun, Moon, Monitor } from 'lucide-react';

const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
];

export default function ThemeToggle() {
    const { theme, setTheme } = useStore();

    return (
        <div className="flex items-center bg-background-dark rounded-full p-1 gap-0.5">
            {options.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    onClick={() => setTheme(value)}
                    title={label}
                    className={`p-2 rounded-full transition-all ${theme === value
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-lighter hover:text-text'
                        }`}
                >
                    <Icon className="w-4 h-4" />
                </button>
            ))}
        </div>
    );
}
