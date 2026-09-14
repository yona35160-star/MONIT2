import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner } from '../components/ui';

// Lazy-loaded pages
const DriverLogin = lazy(() => import('../pages/DriverLogin').then(m => ({ default: m.DriverLogin })));
const DriverPortal = lazy(() => import('../pages/DriverPortal').then(m => ({ default: m.DriverPortal })));
const DriverRegistration = lazy(() => import('../pages/DriverRegistration').then(m => ({ default: m.DriverRegistration })));
const AcceptRide = lazy(() => import('../pages/AcceptRide').then(m => ({ default: m.AcceptRide })));
const CompleteRide = lazy(() => import('../pages/CompleteRide').then(m => ({ default: m.CompleteRide })));
const RideDetails = lazy(() => import('../pages/RideDetails').then(m => ({ default: m.RideDetails })));

const LoadingSpinner = () => <Spinner role="driver" label="טוען פורטל נהג..." />;

export const DriverApp: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('taxi_driver_token');
        if (token) setIsAuthenticated(true);
    }, []);

    useEffect(() => {
        import('../api/driverApi').then(({ initializeApiUrl }) => {
            const saved = localStorage.getItem('taxi_app_script_url');
            if (saved) initializeApiUrl(saved);
        });
    }, []);

    const handleLogin = () => setIsAuthenticated(true);
    const handleLogout = () => {
        localStorage.removeItem('taxi_driver_token');
        localStorage.removeItem('taxi_driver_id');
        setIsAuthenticated(false);
    };

    const ProtectedPortal = () => {
        if (!isAuthenticated) return <Navigate to="/" replace />;
        return <DriverPortal onLogout={handleLogout} />;
    };

    return (
        <ErrorBoundary>
            <HashRouter>
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        {/* Home is login (or redirect to portal if authenticated) */}
                        <Route
                            path="/"
                            element={
                                isAuthenticated
                                    ? <Navigate to="/portal" replace />
                                    : <DriverLogin onLogin={handleLogin} />
                            }
                        />
                        <Route path="/portal" element={
                            <ErrorBoundary key="driver-portal">
                                <ProtectedPortal />
                            </ErrorBoundary>
                        } />
                        <Route path="/register-driver" element={<DriverRegistration />} />
                        <Route path="/accept-ride" element={<AcceptRide />} />
                        <Route path="/complete-ride" element={<CompleteRide />} />
                        <Route path="/ride/:orderId" element={<RideDetails />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </HashRouter>
        </ErrorBoundary>
    );
};
