import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, AlertTriangle, Car, X } from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'new_order';

export interface AlertData {
  id: string;
  type: AlertType;
  title: string;
  subtitle?: string;
}

export const DynamicIslandAlert: React.FC<{
  alerts: AlertData[];
  onDismiss: (id: string) => void;
}> = ({ alerts, onDismiss }) => {
  const activeAlert = alerts.length > 0 ? alerts[0] : null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-start justify-center pointer-events-none w-full px-4">
      <motion.div
        layout
        initial={{ y: -50, opacity: 0, scale: 0.8, borderRadius: 32 }}
        animate={{ 
          y: activeAlert ? 0 : -50, 
          opacity: activeAlert ? 1 : 0,
          scale: activeAlert ? 1 : 0.8,
          borderRadius: activeAlert ? 24 : 32
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="bg-black/90 backdrop-blur-md text-white shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto overflow-hidden flex flex-col min-w-[200px]"
        style={{ minHeight: activeAlert ? 48 : 0, originY: 0 }}
      >
        <AnimatePresence mode="wait">
          {activeAlert && (
            <motion.div 
              key={activeAlert.id}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              className="flex items-center gap-3 px-4 py-3 min-w-[280px] max-w-[400px]"
            >
              {activeAlert.type === 'new_order' && <Car className="text-yellow-400 w-6 h-6 flex-shrink-0 animate-bounce" />}
              {activeAlert.type === 'success' && <CheckCircle className="text-green-400 w-6 h-6 flex-shrink-0" />}
              {activeAlert.type === 'warning' && <AlertTriangle className="text-red-400 w-6 h-6 flex-shrink-0" />}
              {activeAlert.type === 'info' && <Bell className="text-blue-400 w-6 h-6 flex-shrink-0" />}
              
              <div className="flex-1 flex justify-between items-center gap-4 border-l border-white/10 pl-3 ml-1" dir="rtl">
                <div className="flex flex-col text-right">
                  <span className="text-sm font-bold text-white tracking-wide">{activeAlert.title}</span>
                  {activeAlert.subtitle && (
                    <span className="text-xs text-white/70 line-clamp-1">{activeAlert.subtitle}</span>
                  )}
                </div>
                <button 
                  onClick={() => onDismiss(activeAlert.id)}
                  className="bg-white/10 p-1.5 rounded-full hover:bg-white/20 transition-colors active:scale-95"
                >
                  <X className="w-4 h-4 text-white/90" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
