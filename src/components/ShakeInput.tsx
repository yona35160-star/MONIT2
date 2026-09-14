import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../utils/ui';
import React, { useEffect, useState } from 'react';

interface ShakeInputProps extends HTMLMotionProps<"input"> {
    isInvalid?: boolean;
}

export const ShakeInput = React.forwardRef<HTMLInputElement, ShakeInputProps>(
    ({ isInvalid, className, ...props }, ref) => {
        const [shakeKey, setShakeKey] = useState(0);

        useEffect(() => {
            if (isInvalid) {
                setShakeKey(prev => prev + 1);
            }
        }, [isInvalid]);

        return (
            <motion.input
                ref={ref}
                key={shakeKey}
                initial={{ x: 0 }}
                animate={isInvalid ? { x: [-4, 4, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.4, type: "spring", stiffness: 500 }}
                className={cn(className)}
                {...props}
            />
        );
    }
);

ShakeInput.displayName = 'ShakeInput';
