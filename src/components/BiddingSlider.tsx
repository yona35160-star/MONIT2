import React, { useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '../utils/ui';

interface BiddingSliderProps {
  basePrice: number;
  onBidChange: (extra: number) => void;
  className?: string;
}

export const BiddingSlider: React.FC<BiddingSliderProps> = ({
  basePrice,
  onBidChange,
  className
}) => {
  const steps = [0, 5, 10, 20];
  const [selectedStep, setSelectedStep] = useState(0);

  const handleSelect = (val: number) => {
    setSelectedStep(val);
    onBidChange(val);
    
    // Simulate haptic feedback if available
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }
  };

  return (
    <div className={cn("p-6 bg-white border border-slate-200 rounded-[2rem] shadow-premium", className)}>
      <div className="flex justify-between items-start mb-8" dir="rtl">
        <div>
          <h3 className="font-black text-slate-900 tracking-tight text-xl mb-1">תמריץ עידוד פרימיום</h3>
          <p className="text-sm text-slate-500 font-medium">הקפץ את הנסיעה לראש התור של הנהגים</p>
        </div>
        <div className="text-left bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl" dir="ltr">
          <span className="text-[10px] text-white/50 font-bold block mb-[-2px] uppercase tracking-widest">Total Price</span>
          <motion.span 
            key={selectedStep}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-black block leading-none"
          >
            ₪{basePrice + selectedStep}
          </motion.span>
        </div>
      </div>

      <div className="relative flex justify-between items-center px-4 py-6" dir="rtl">
        {/* Background Track */}
        <div className="absolute left-4 right-4 h-4 bg-slate-100 rounded-full top-1/2 -translate-y-1/2 shadow-inner border border-slate-200" />
        
        {/* Active Fill Track */}
        <motion.div 
          className="absolute right-4 h-4 bg-gradient-to-l from-yellow-400 to-amber-500 rounded-full top-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(250,204,21,0.4)]"
          initial={false}
          animate={{ width: `calc(${(steps.indexOf(selectedStep) / (steps.length - 1)) * 100}% - 0%)` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />

        {steps.map((val) => {
          const isActive = val <= selectedStep;
          const isSelected = val === selectedStep;
          return (
            <button
              key={val}
              onClick={() => handleSelect(val)}
              className="relative z-10 flex flex-col items-center group touch-none outline-none focus:outline-none"
            >
              <motion.div 
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative border-2",
                  isSelected ? "bg-slate-900 border-slate-900 text-white shadow-2xl" : 
                  isActive ? "bg-white border-yellow-400 text-slate-900 shadow-lg" : "bg-white border-slate-200 text-slate-400 active:scale-95"
                )}
                whileHover={{ y: -5 }}
                animate={{ 
                    scale: isSelected ? 1.2 : 1,
                    rotate: isSelected ? [0, -5, 5, 0] : 0
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              >
                {isSelected && (
                    <motion.div 
                        layoutId="activeGlow"
                        className="absolute -inset-2 bg-yellow-400/20 rounded-3xl blur-md -z-10"
                    />
                )}
                <span className={cn(
                  "text-xs font-black relative z-20", 
                  isSelected ? "text-yellow-400 text-sm" : ""
                )}>
                  {val === 0 ? 'FIX' : `+${val}`}
                </span>
              </motion.div>
              
              <span className={cn(
                  "absolute -bottom-6 text-[10px] font-black uppercase tracking-tighter transition-opacity",
                  isSelected ? "opacity-100 text-slate-900" : "opacity-0"
              )}>
                  {val === 0 ? "Standard" : "Priority"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
