import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../../store';

export default function AuthGuard() {
    const { user, isAuthLoading } = useStore();

    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#137fec] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) return <Navigate to="/auth" replace />;

    return <Outlet />;
}
