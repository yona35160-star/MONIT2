import React, { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AdminLayout } from '../components/AdminLayout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { setAdminLogout } from '../store/slices/authSlice';
import { RootState } from '../store';
import { Spinner } from '../components/ui';

// Lazy-loaded pages
const Login = lazy(() => import('../pages/Login').then(m => ({ default: m.Login })));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Settings = lazy(() => import('../pages/Settings').then(m => ({ default: m.Settings })));
const ManualDriverAdd = lazy(() => import('../pages/ManualDriverAdd').then(m => ({ default: m.ManualDriverAdd })));
const DriverDetails = lazy(() => import('../pages/DriverDetails').then(m => ({ default: m.DriverDetails })));
const MarketingDashboard = lazy(() => import('../pages/MarketingDashboard').then(m => ({ default: m.MarketingDashboard })));
const AdminAnalytics = lazy(() => import('../pages/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminPublisher = lazy(() => import('../pages/AdminPublisher').then(m => ({ default: m.AdminPublisher })));
const StationOrder = lazy(() => import('../pages/StationOrder').then(m => ({ default: m.StationOrder })));

const LoadingSpinner = () => <Spinner role="admin" label="טוען מערכת ניהול..." />;

export const AdminApp: React.FC = () => {
    const dispatch = useDispatch();
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAdminAuthenticated);

    useEffect(() => {
        import('../api/adminApi').then(({ initializeApiUrl }) => {
            const saved = localStorage.getItem('taxi_app_script_url');
            if (saved) initializeApiUrl(saved);
        });
    }, []);

    // Validate stored token against server
    useEffect(() => {
        const token = localStorage.getItem('taxi_auth_token');
        if (token && isAuthenticated) {
            import('../api/adminApi').then(({ sendToBackend }) => {
                sendToBackend('checkAuth', { token }).then(res => {
                    // Only logout if the server explicitly rejects the token (Unauthorized)
                    if (!res.ok && res.error && String(res.error).toLowerCase().includes('unauthorized')) {
                        console.warn("Session expired or invalid token - logging out.");
                        dispatch(setAdminLogout());
                    }
                }).catch(() => { /* silent skip on network errors to prevent false logouts */ });
            });
        }
    }, [isAuthenticated, dispatch]);

    const handleLogout = () => dispatch(setAdminLogout());

    const ProtectedRoutes = () => {
        if (!isAuthenticated) return <Navigate to="/" replace />;
        return <AdminLayout onLogout={handleLogout}><Outlet /></AdminLayout>;
    };

    return (
        <ErrorBoundary>
            <HashRouter>
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        {/* Home is login (or redirect to dashboard if authenticated) */}
                        <Route
                            path="/"
                            element={
                                isAuthenticated
                                    ? <Navigate to="/dashboard" replace />
                                    : <Login />
                            }
                        />
                        {/* Login page navigates to /admin after success */}
                        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/station-order" element={<StationOrder />} />
                        <Route path="/station" element={<Navigate to="/station-order" replace />} />
                        <Route path="/dispatch" element={<Navigate to="/station-order" replace />} />
                        <Route element={
                            <ErrorBoundary key="admin-boundary">
                                <ProtectedRoutes />
                            </ErrorBoundary>
                        }>
                            <Route path="/dashboard" element={<AdminDashboard />} />
                            <Route path="/analytics" element={<AdminAnalytics />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/add-driver" element={<ManualDriverAdd />} />
                            <Route path="/marketing" element={<MarketingDashboard />} />
                            <Route path="/publish" element={<AdminPublisher />} />
                            <Route path="/driver/:driverId" element={<DriverDetails />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </HashRouter>
        </ErrorBoundary>
    );
};
