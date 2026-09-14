import { useEffect, useRef } from 'react';

export const useFocusTrap = (isOpen: boolean) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const element = ref.current;
        if (!element) return;

        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        const keyListener = (e: KeyboardEvent) => handleTabKey(e);
        document.addEventListener('keydown', keyListener);

        // Focus the first element when the modal opens
        if (firstElement) {
            firstElement.focus();
        }

        return () => {
            document.removeEventListener('keydown', keyListener);
        };
    }, [isOpen]);

    return ref;
};
