import React, { useRef } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { Pencil, ArrowRight } from 'lucide-react';
import { cn } from '../utils/ui';

interface SwipeCardProps {
    children: React.ReactNode;
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
    rightActionText?: string;
    leftActionText?: string;
    rightActionIcon?: React.ReactNode;
    leftActionIcon?: React.ReactNode;
    threshold?: number;
    className?: string;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
    children,
    onSwipeRight,
    onSwipeLeft,
    rightActionText = 'שיבוץ / עריכה',
    leftActionText = 'פעולה נוספת',
    rightActionIcon = <Pencil size={20} />,
    leftActionIcon = <Pencil size={20} />,
    threshold = 80,
    className
}) => {
    const controls = useAnimation();
    const cardRef = useRef<HTMLDivElement>(null);

    const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const offset = info.offset.x;

        // Swipe Right (in RTL this means sliding the card to the right, revealing the left background)
        // Wait, in RTL: dragging RIGHT (positive x) reveals the LEFT side.
        if (offset > threshold && onSwipeRight) {
            // Animate out
            await controls.start({ x: window.innerWidth });
            onSwipeRight();
            // Reset position instantly
            controls.start({ x: 0, transition: { duration: 0 } });
        }
        // Swipe Left
        else if (offset < -threshold && onSwipeLeft) {
            await controls.start({ x: -window.innerWidth });
            onSwipeLeft();
            controls.start({ x: 0, transition: { duration: 0 } });
        }
        // Snap back
        else {
            controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        }
    };

    return (
        <div className={cn("relative overflow-hidden rounded-2xl", className)}>
            {/* Background Actions */}
            <div className="absolute inset-0 flex items-center justify-between px-6 bg-slate-900 text-white font-bold rounded-2xl">
                {onSwipeRight && (
                    <div className="flex items-center gap-2 opacity-50 transition-opacity">
                        {rightActionIcon}
                        <span>{rightActionText}</span>
                    </div>
                )}
                <div className="flex-1" />
                {onSwipeLeft && (
                    <div className="flex items-center gap-2 opacity-50 transition-opacity" dir="rtl">
                        {leftActionIcon}
                        <span>{leftActionText}</span>
                    </div>
                )}
            </div>

            {/* Foreground Draggable Card */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={handleDragEnd}
                animate={controls}
                className="relative z-10 bg-white h-full w-full rounded-2xl"
                whileTap={{ scale: 0.98 }}
                style={{ touchAction: 'pan-y' }}
            >
                {children}
            </motion.div>
        </div>
    );
};
