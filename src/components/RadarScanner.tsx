import React from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { cn } from '../utils/ui';

interface RadarScannerProps {
  text?: string;
  className?: string;
}

export const RadarScanner: React.FC<RadarScannerProps> = ({ 
  text = "מחפש נהגים באזור...", 
  className 
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8", className)}>
      <div className="relative flex items-center justify-center w-36 h-36 mb-6">
        {/* Radar Pulses */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-primary-500/50 bg-primary-100/10 shadow-lg shadow-primary-500/20"
            initial={{ width: 0, height: 0, opacity: 1 }}
            animate={{ 
              width: '100%', 
              height: '100%', 
              opacity: 0 
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              delay: i * 0.6,
              ease: "easeOut"
            }}
          />
        ))}
        {/* Center Target */}
        <div className="relative z-10 bg-primary-500 rounded-full p-4 shadow-[0_0_20px_theme(colors.primary.500)]">
          <MapPin className="text-white w-8 h-8" />
        </div>
      </div>
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="text-lg font-bold text-slate-800 tracking-wide text-center"
      >
        {text}
      </motion.p>
    </div>
  );
};
