import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export const RouteErrorBoundary: React.FC = () => {
    const error = useRouteError();

    let errorMessage: string;
    let errorTitle: string;

    if (isRouteErrorResponse(error)) {
        // page threw an ErrorResponse (e.g., 404, 401, 503)
        errorTitle = `${error.status} - ${error.statusText}`;
        errorMessage = error.data?.message || 'אירעה שגיאה בטעינת העמוד.';
    } else if (error instanceof Error) {
        // component threw an Error
        errorTitle = 'שגיאת מערכת';
        errorMessage = error.message;
    } else {
        // unexpected error
        errorTitle = 'שגיאה לא צפויה';
        errorMessage = 'אירעה שגיאה לא ידועה.';
    }

    // Reload handler
    const handleRetry = () => {
        window.location.reload();
    };

    // Home handler
    const handleHome = () => {
        window.location.href = '/';
    };

    return (
        <div className="min-h-[50vh] flex items-center justify-center p-6 text-center" dir="rtl">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>

                <h2 className="text-xl font-black text-slate-800 mb-2">{errorTitle}</h2>
                <p className="text-slate-500 mb-8">{errorMessage}</p>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleRetry}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition"
                    >
                        <RefreshCw size={18} />
                        נסה שוב
                    </button>

                    <button
                        onClick={handleHome}
                        className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition"
                    >
                        <Home size={18} />
                        חזרה לדף הבית
                    </button>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50">
                    <p className="text-xs text-slate-400 font-mono text-left ltr">
                        Trace ID: {Math.random().toString(36).substring(7)}
                    </p>
                </div>
            </div>
        </div>
    );
};
