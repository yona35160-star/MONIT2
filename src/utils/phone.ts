/**
 * Phone number normalization utility
 * Ensures consistent formatting for Israeli phone numbers
 * 
 * @param phone - Phone number in any format
 * @returns Normalized phone number (10 digits, starting with 0)
 * 
 * @example
 * normalizePhone('525296014')  // '0525296014'
 * normalizePhone('0525296014') // '0525296014'
 * normalizePhone('+972525296014') // '0525296014'
 * normalizePhone('972525296014') // '0525296014'
 */
/**
 * Phone number normalization utility
 * Ensures consistent formatting for Israeli phone numbers, keeps others as digits
 * 
 * @param phone - Phone number in any format
 * @returns Normalized phone number
 * 
 * @example
 * normalizePhone('052-5296014') // '0525296014'
 * normalizePhone('+972-52-5296014') // '0525296014'
 * normalizePhone('+1 (555) 123-4567') // '15551234567'
 */
export const normalizePhone = (phone: string): string => {
    if (!phone) return '';

    // Remove all non-digit characters
    let p = phone.replace(/\D/g, '');

    // Handle Israeli international format (972) -> Local (0)
    if (p.startsWith('972') && p.length > 9) {
        p = '0' + p.substring(3);
    }

    // Add leading zero if missing for Israeli mobile (9 digits starting with 5)
    if (p.length === 9 && p.startsWith('5')) {
        p = '0' + p;
    }

    // Add leading zero if missing for Israeli landline (8 digits starting with 2,3,4,8,9)
    if (p.length === 8 && /^[23489]/.test(p)) {
        p = '0' + p;
    }

    return p;
};

/**
 * Validates a phone number (Israeli or International)
 * @param phone - Phone number to validate
 * @returns true if valid
 */
export const isValidPhone = (phone: string): boolean => {
    const p = normalizePhone(phone);

    // Israel Mobile: 05X-XXXXXXX (10 digits)
    if (p.startsWith('05') && p.length === 10) return true;

    // Israel Landline: 0X-XXXXXXX (9 digits) - Optional but good to have
    if (p.startsWith('0') && p.length === 9) return true;

    // International: Simple check for length (10-15 digits)
    // Assuming non-0 prefix for international (like 1 for US, 44 for UK etc)
    // But normalized +972 becomes 05, so that's handled above.
    // If it starts with non-0, it's likely foreign (or 1-800 etc, but good enough)
    if (!p.startsWith('0') && p.length >= 10 && p.length <= 15) return true;

    return false;
};
