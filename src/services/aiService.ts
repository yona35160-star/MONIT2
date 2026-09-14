import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API using Vite's env variables
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const aiClient = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Initialize the standard capable model
const model = aiClient ? aiClient.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

/**
 * AI NLP Parser for turning free text into Structured Orders
 * @param text The free text dispatcher command (Hebrew)
 */
export const aiParseOrder = async (text: string) => {
    if (!model) throw new Error("מפתח VITE_GEMINI_API_KEY חסר במערכת. נדרש להגדיר דרך קבצי צד הלקוח.");
    
    const prompt = `
אתה סדרן מוניות מומחה לתחנות בישראל. הלקוח נתן לך הנחיה כטקסט חופשי ליצור הזמנת מונית חדשה.
תפקידך למצות את המידע ולחזיר *אך ורק* אובייקט JSON חוקי! ללא שום מילים נוספות, ללא markdown וללא הערות.

השדות הנדרשים ב-JSON:
- passengerName (שם הנוסע - אם לא קיים, השתמש ב "לא סופק")
- passengerPhone (טלפון - אם לא קיים השאר מחרוזת ריקה "")
- pickupLocation (כתובת איסוף מדויקת ככל הניתן)
- destination (יעד הנסיעה מדויק ככל הניתן)
- passengers (מספר נוסעים כ-number, ברירת מחדל 1)

דוגמה: 
טקסט: "קח את יוסי מדיזנגוף לנתב"ג לבד הוא מחכה 0541234567"
פלט:
{
  "passengerName": "יוסי",
  "passengerPhone": "0541234567",
  "pickupLocation": "דיזנגוף, תל אביב",
  "destination": "נתב"ג",
  "passengers": 1
}

הטקסט לעיבוד: "${text}"
`;

    try {
        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim();
        
        // Robust JSON extraction
        const startIdx = rawText.indexOf('{');
        const endIdx = rawText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            rawText = rawText.substring(startIdx, endIdx + 1);
        } else {
            throw new Error("לא נמצא מבנה JSON תקין בתשובה");
        }

        return JSON.parse(rawText);
    } catch (error: any) {
        console.error("AI Parse Error:", error);
        throw new Error("קרתה שגיאה בפענוח הטקסט עם AI. אנא ודא שהטקסט ברור והמפתח תקין.");
    }
};

/**
 * AI Executive Summary
 * Generates an executive summary based on the daily metrics
 */
export const aiGenerateDailyBrief = async (stats: any, activeOrdersCount: number, activeDriversCount: number) => {
    if (!model) throw new Error("מפתח VITE_GEMINI_API_KEY חסר במערכת. נדרש להגדיר כדי להפיק דוח.");

    const prompt = `
אתה "Chief of Operations" של תחנת מוניות מצליחה בישראל.
סיים את עבודתך בכתיבת עדכון מנהלים מסכם להיום (בעברית עסקית זורמת, לא פורמלית מדי אבל מקצועית ושנונה). התייחס לנתונים המספריים מטה.

המחזור היומי: ₪${stats?.revenueToday || 0}
כמות נסיעות שהושלמו היום: ${stats?.ordersToday || 0}
הזמנות שפתוחות כרגע (באוויר): ${activeOrdersCount}
נהגים במשמרת כעת: ${activeDriversCount}

הוראות לכתיבה:
1. תייצר פסקה קצרה אחת או פירוט נקודות (Bullet points) עם ניתוח מעניין.
2. תן מחמאה או קריאת עידוד אם המחזור גדול מ-500 ש"ח, ולהיפך - שפר מוטיבציה אם המצב חלש.
3. השתמש באימוג'ים מתאימים כדי לשבור קוביות טקסט שחורות.
4. זכור: ענה אך ורק בעברית!
`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("AI Summarize Error:", error);
        throw new Error("שגיאה ביצירת סיכום מנהלים. ייתכן שהשרת אינו מגיב כעת.");
    }
};

/**
 * AI Smart Driver Assigner
 * Chooses the best driver based on contextual information
 */
export const aiRecommendDriver = async (order: any, driversList: any[]) => {
    if (!model) throw new Error("מפתח VITE_GEMINI_API_KEY חסר במערכת לביצוע שיוך אוטומטי.");

    const prompt = `
אתה סדרן מוניות ראשי חכם. יש לך נסיעה חדשה ויש לך רשימה של נהגים פנויים באוויר.
מכיוון שחישובי המרחק (בק"מ) חושבו עבורך מראש, עליך להסתכל עליהם, לבחון את הנתונים ולבחור את הנהג המתאים ביותר!
עליך להחזיר *אך ורק* אובייקט JSON חוקי ללא markdown וללא מילים נוספות! אובייקט עם שני שדות בלבד:
- driverPhone: הטלפון של הנהג שבחרת
- reason: במשפט בעברית, מדוע בחרת בו (למשל: "הכי קרוב לאיסוף - 1.2 ק"מ").

פרטי הנסיעה:
איסוף מ: ${order.pickupAddress}
יעד ל: ${order.destinationAddress}
הערות מיוחדות: ${order.pickupNotes || 'אין'}

רשימת הנהגים הפנויים לבחירה:
${JSON.stringify(driversList.map(d => ({
    name: d.driverName,
    phone: d.phone,
    serviceArea: d.serviceArea || "כללי",
    distanceKm: typeof d.distance === 'number' ? d.distance.toFixed(2) : "לא ידוע",
})), null, 2)}
`;

    try {
        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim();
        
        // Robust JSON extraction
        const startIdx = rawText.indexOf('{');
        const endIdx = rawText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            rawText = rawText.substring(startIdx, endIdx + 1);
        } else {
            throw new Error("לא נמצא מבנה JSON תקין בתשובה");
        }

        const data = JSON.parse(rawText);
        return data as { driverPhone: string, reason: string };
    } catch (error: any) {
        console.error("AI Smart Assign Error:", error);
        throw new Error("כשל בפענוח ה-AI לשיוך חכם. ודא חיבור תקין.");
    }
};
