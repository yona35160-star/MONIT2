import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '../utils/ui';

interface LiquidSwipeProps {
  onAccept: () => void;
  text?: string;
  successText?: string;
  className?: string;
}

export const LiquidSwipe: React.FC<LiquidSwipeProps> = ({
  onAccept,
  text = 'החלק לאישור נסיעה',
  successText = 'נסיעה אושרה!',
  className
}) => {
  const [accepted, setAccepted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const backgroundWidth = useTransform(x, [0, 300], ['56px', '100%']);
  const controls = useAnimation();

  const handleDragEnd = async (e: any, info: any) => {
    if (accepted) return;
    const containerWidth = containerRef.current?.getBoundingClientRect().width || 300;
    
    if (info.offset.x > containerWidth * 0.65) {
      setAccepted(true);
      await controls.start({ x: containerWidth - 56, transition: { duration: 0.2 } });
      onAccept();
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  useEffect(() => {
    const unsubscribe = x.onChange(() => {});
    return () => unsubscribe();
  }, [x]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative h-14 bg-slate-900 rounded-full overflow-hidden flex items-center shadow-inner", 
        className
      )}
      dir="ltr"
    >
      {/* Expanding Background */}
      <motion.div 
        className={cn("absolute left-0 top-0 bottom-0 pointer-events-none rounded-full transition-colors duration-500", accepted ? "bg-green-500" : "bg-primary-500")}
        style={{ width: accepted ? '100%' : backgroundWidth }}
        layout
      />

      {/* Text Base */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className={cn(
          "font-bold transition-all duration-300 px-8 text-center",
          accepted ? "text-white opacity-100 scale-110 drop-shadow-md" : "text-white opacity-70"
        )} dir="rtl">
          {accepted ? successText : text}
        </span>
      </div>

      {/* Draggable Thumb */}
      <motion.div
        drag={!accepted ? "x" : false}
        dragConstraints={containerRef}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className="relative z-10 w-[50px] h-[50px] ml-[3px] bg-white rounded-full flex items-center justify-center cursor-touch active:cursor-grabbing shadow-lg touch-none"
        whileTap={!accepted ? { scale: 0.95 } : {}}
      >
        <motion.div
          animate={{ rotate: accepted ? 360 : 0 }}
          transition={{ duration: 0.5 }}
        >
          {accepted ? (
            <Check className="text-green-500 w-6 h-6" />
          ) : (
            <ChevronRight className="text-primary-500 w-6 h-6 animate-pulse" />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};
