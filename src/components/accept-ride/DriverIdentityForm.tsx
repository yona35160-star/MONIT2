import React from 'react';
import { User, CheckCircle, Phone, ShieldCheck } from 'lucide-react';

interface DriverIdentityFormProps {
    identityType: 'telegram' | 'phone' | null;
    tgUser: any;
    phoneNumber: string;
    setPhoneNumber: (val: string) => void;
    setIdentityType: (val: 'telegram' | 'phone' | null) => void;
    agreedToTerms: boolean;
    setAgreedToTerms: (val: boolean) => void;
    handleConfirmAndAccept: () => void;
}

export const DriverIdentityForm: React.FC<DriverIdentityFormProps> = ({
    identityType,
    tgUser,
    phoneNumber,
    setPhoneNumber,
    setIdentityType,
    agreedToTerms,
    setAgreedToTerms,
    handleConfirmAndAccept
}) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2 text-center">אישור קבלת נסיעה</h2>
            <p className="text-gray-500 text-center mb-5 sm:mb-8 text-xs sm:text-sm">
                אנא אשר את פרטי הזיהוי שלך כדי לקבל את הנסיעה.
            </p>

            {/* Identity Card */}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 mb-4 sm:mb-6">
                {identityType === 'telegram' ? (
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md">
                            {tgUser.photo_url ? <img src={tgUser.photo_url} alt="" className="w-full h-full rounded-full" /> : <User />}
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">מזוהה כמשתמש טלגרם</p>
                            <p className="font-bold text-slate-800 text-base sm:text-lg">
                                {tgUser.first_name} {tgUser.last_name}
                            </p>
                        </div>
                        <CheckCircle className="mr-auto text-green-500" />
                    </div>
                ) : (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">מספר הנייד שלך</label>
                        <div className="relative">
                            <input
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className={`w-full p-3.5 sm:p-4 pl-10 sm:pl-12 pr-10 sm:pr-12 bg-white border rounded-xl text-base sm:text-lg font-bold text-slate-900 focus:ring-2 focus:ring-yellow-400 outline-none transition text-left
                                    ${phoneNumber.length >= 9 ? 'border-green-500 bg-green-50/30' : 'border-gray-300'}`}
                                placeholder="050-0000000"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                                dir="ltr"
                            />
                            <Phone className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            {phoneNumber.length >= 9 && (
                                <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" size={20} />
                            )}
                        </div>
                    </div>
                )}

                {identityType === null && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">הזן מספר נייד לזיהוי</label>
                        <div className="relative">
                            <input
                                type="tel"
                                className="w-full p-3.5 sm:p-4 pl-10 sm:pl-12 bg-white border border-gray-300 rounded-xl text-base sm:text-lg font-bold text-slate-900 focus:ring-2 focus:ring-yellow-400 outline-none transition text-left"
                                placeholder="050-0000000"
                                value={phoneNumber}
                                onChange={e => {
                                    setPhoneNumber(e.target.value);
                                    setIdentityType('phone'); // Switch to phone mode on type
                                }}
                                dir="ltr"
                            />
                            <Phone className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>
                )}
            </div>

            {/* Legal Consent */}
            <div className="mb-5 sm:mb-8">
                <label className="flex items-start gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg transition">
                    <div className="relative flex items-center mt-1">
                        <input
                            type="checkbox"
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm checked:bg-slate-900 checked:border-slate-900"
                            checked={agreedToTerms}
                            onChange={e => setAgreedToTerms(e.target.checked)}
                        />
                        <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                    </div>
                    <span className="text-xs text-gray-500 leading-tight select-none">
                        אני מאשר/ת את זיהויי במערכת ומסכים/ה ל<a href="/privacy-policy" target="_blank" className="text-blue-600 underline">תנאי השימוש</a> ול<a href="/privacy-policy" target="_blank" className="text-blue-600 underline">מדיניות הפרטיות</a>. ידוע לי שפרטי הלקוח ישלחו אליי לאחר האישור.
                    </span>
                </label>
            </div>

            <button
                onClick={handleConfirmAndAccept}
                disabled={!agreedToTerms || !phoneNumber || phoneNumber.replace(/\D/g, '').length < 9}
                className="w-full h-14 sm:h-20 bg-slate-900 text-white rounded-2xl font-bold text-base sm:text-xl shadow-xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
                <ShieldCheck size={20} />
                אשר וקח נסיעה
            </button>
        </div>
    );
};
