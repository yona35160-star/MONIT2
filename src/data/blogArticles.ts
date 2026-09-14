export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  category: string;
  imageUrl: string;
  readingTimeMin: number;
}

export const blogArticles: BlogPost[] = [
  {
    id: "1",
    slug: "taxi-to-ben-gurion-airport-2026",
    title: "10 טיפים זהב להזמנת מונית לנתב״ג בשנת 2026",
    excerpt: "כל מה שצריך לדעת על מחירי מוניות לשדה התעופה, איך להימנע מעוקץ, ולמה כדאי להזמין מראש דרך אפליקציה מתקדמת.",
    content: `
      <h2>למה כדאי להזמין מונית לנתב"ג מראש?</h2>
      <p>הזמנת מונית לשדה התעופה בן גוריון הפכה למשימה פשוטה בזכות אפליקציות טכנולוגיות. עם זאת, השארת ההזמנה לרגע האחרון עלולה לייצר לחץ ואי ודאות. לכן, בשנת 2026 המגמה ברורה: הזמנה מראש.</p>
      <h2>השוואת מחירים לנתב"ג</h2>
      <p>מחירון התחבורה של משרד התחבורה מגדיר תעריפים בהתאם לשעות היום, כמות הנוסעים ואזור האיסוף. עם מערכת <strong>TAXIPRO</strong>, אנו משקללים את הנתונים ומציגים את המחיר הסופי בצורה שקופה.</p>
      <ul>
        <li><strong>שקיפות:</strong> דע בדיוק כמה אתה צפוי לשלם.</li>
        <li><strong>נוחות:</strong> הנהג כבר יודע היכן למצוא אותך.</li>
        <li><strong>שירות טרמינל 3/1:</strong> איסוף ופיזור מדויק לטרמינל הנכון.</li>
      </ul>
      <h2>טכנולוגיית סנכרון טיסות</h2>
      <p>הנהגים המחוברים למערכת המוניות שלנו משתמשים בכלים כמו מעקב המראות ונחיתות אונליין.</p>
    `,
    date: "2026-03-01",
    author: "צוות TAXIPRO",
    category: "תעופה ותיירות",
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    readingTimeMin: 4
  },
  {
    id: "2",
    slug: "smart-taxi-app-vs-traditional",
    title: "אפליקציית מוניות מול תחנת מוניות מסורתית: מה משתלם יותר?",
    excerpt: "השוואה מעמיקה בין הזמנה דרך תחנת מוניות טלפונית לבין הזמנה בקליק באפליקציה טכנולוגית כמו TAXIPRO.",
    content: `
      <h2>תחנות מוניות מסורתיות - סוף עידן?</h2>
      <p>בעשור האחרון, תחנות מוניות בישראל דרשו התקשרות טלפונית, המתנה על הקו למרכזנית, ולעיתים ניחוש לגבי זמן ההגעה המשוער.</p>
      <h2>היתרון של אפליקציה מתקדמת</h2>
      <p>באמצעות טכנולוגיה, נמחקים כל צווארי הבקבוק.</p>
      <ul>
        <li><strong>זמן הגעה:</strong> ממוצע המתנה צונח מ-12 דקות דרך תחנה, ל-4.5 דקות באפליקציה.</li>
        <li><strong>מעקב חי:</strong> הנוסע רואה את מיקום המונית על המפה.</li>
        <li><strong>תמחור:</strong> אפשרות לדעת את העלות לפני שעולים למונית.</li>
      </ul>
    `,
    date: "2026-02-15",
    author: "צוות TAXIPRO",
    category: "טכנולוגיה",
    imageUrl: "https://images.unsplash.com/photo-1528629297340-d1d466945cb5?w=800&q=80",
    readingTimeMin: 3
  },
  {
    id: "3",
    slug: "taxi-fares-israel-2026",
    title: "תעריפי המוניות החדשים בישראל לשנת 2026 - המדריך המלא",
    excerpt: "כיצד מחשבים עלות נסיעה במונית? מה מסמל כל תעריף (תעריף 1, 2 ו-3) ומה חשוב לדעת על עומסי תנועה.",
    content: `
      <h2>פירוט תעריפים: 1, 2 ו-3</h2>
      <ul>
        <li><strong>תעריף 1:</strong> תעריף רגיל ליום חול עד שעות הערב.</li>
        <li><strong>תעריף 2:</strong> מופעל בשעות הלילה המאוחרות וכן בשישי-שבת.</li>
        <li><strong>תעריף 3:</strong> תעריף מיוחד לימי חג.</li>
      </ul>
    `,
    date: "2026-02-10",
    author: "דנה רון",
    category: "צרכנות",
    imageUrl: "https://images.unsplash.com/photo-1554672408-730436b60dde?w=800&q=80",
    readingTimeMin: 4
  },
  {
    id: "4",
    slug: "what-is-a-bidding-slider",
    title: "מהפכת ה-Bidding: איך תגרום למונית להגיע אלייך מהר יותר על ידי שליטה במחיר",
    excerpt: "כל מה שצריך לדעת על התמריץ הכספי (Tip Incentive) במסגרת הזמנת מונית טכנולוגית בזמן אמת.",
    content: `
      <h2>למה שנוסע ירצה לשלם יותר?</h2>
      <p>במשק מוניות בו עובדים מודלים של היצע וביקוש חי, לעיתים יש יותר נוסעים שמבקשים מוניות מנהגים זמינים.</p>
      <h2>הכלכלה ההתנהגותית של תמריץ כלכלי</h2>
      <p>באמצעות רכיב ה-<strong>Bidding Slider</strong> השקנו פתרון חלוצי: הנוסע מחזיק במושכות התמחור.</p>
    `,
    date: "2026-02-05",
    author: "צוות TAXIPRO",
    category: "טכנולוגיה",
    imageUrl: "https://images.unsplash.com/photo-1621213346995-1f9e23ba8e13?w=800&q=80",
    readingTimeMin: 2
  },
  {
    id: "5",
    slug: "the-future-of-taxis-ai",
    title: "עתיד התחבורה ב-2026: כיצד בינה מלאכותית מנהלת מוניות?",
    excerpt: "אם חשבתם שאפליקציית מוניות מסתכמת בלחיצת כפתור – תחשבו שוב. המהפכה של AI ו-Predictive Heatmaps מנהלת את העיר.",
    content: `
      <h2>מנקודת מבטו של הנהג: פחות שיטוט, יותר עבודה</h2>
      <p>בימים עברו, נהגי מוניות הסתובבו בעיר בציפייה לנוסע אקראי שירים יד.</p>
      <h2>מפת החום הייעודית - Predictive Heatmap</h2>
      <p>באמצעות רינדור קואורדינטות בזמן אמת של כל הקריאות הפעילות.</p>
    `,
    date: "2026-01-20",
    author: "צוות פיתוח TAXIPRO",
    category: "בינה מלאכותית",
    imageUrl: "https://images.unsplash.com/photo-1542617637-f418d10edbc9?w=800&q=80",
    readingTimeMin: 3
  },
  {
    id: "6",
    slug: "top-5-mistakes-ordering-taxi",
    title: "5 הטעויות הנפוצות ביותר בהזמנת מונית ואיך להימנע מהן",
    excerpt: "כל הטיפים החשובים שיחסכו לכם כסף, זמן ואי הבנות עם נהגי הפלטפורמה.",
    content: `
      <h2>1. הזנת כתובת איסוף מורכבת במקום GPS</h2>
      <p>שימוש במיקום ה-GPS המדויק (Pin) באפליקציה מבטיח לנהג להגיע ישר אליכם.</p>
      <h2>2. חוסר עדכון על כמות נוסעים ומזוודות</h2>
      <p>מונית רגילה יכולה להכיל עד 4 נוסעים עם ציוד ספציפי.</p>
      <h2>3. איחור ליציאה למונית של הנהג</h2>
      <p>המונית ממתינה – המונה נדלק. כל דקת המתנה נוספת היא מיותרת!</p>
    `,
    date: "2026-01-18",
    author: "צוות TAXIPRO",
    category: "מדריכים",
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    readingTimeMin: 5
  },
  {
    id: "7",
    slug: "accessible-taxis-wheelchair-israel",
    title: "מוניות נגישות לכיסא גלגלים - איך מנווטים את הדרך?",
    excerpt: "השירות לבעלי מוגבלויות ותקנות משרד התחבורה בתחום התחבורה הציבורית והפרטית.",
    content: `<h2>תחבורה לכל אזרח</h2><p>אחת מהזכויות הבסיסיות של אזרח היא ניעות טבעית וחופשית.</p>`,
    date: "2026-01-10",
    author: "אמיר כץ",
    category: "נגישות",
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    readingTimeMin: 3
  },
  {
    id: "8",
    slug: "taxis-in-tel-aviv-nightlife",
    title: "נוסעים לבלות? כל מה שצריך לדעת על מוניות במרכז בלילות גדושים",
    excerpt: "הלילה לא נגמר כשאתם בפקק בחזור - אלטרנטיבות לנסיעה נוחה מתל אביב אל הפריפריה.",
    content: `<h2>מרכז ההתרחשות</h2><p>תל אביב בליל שישי וחמישי סואנת.</p>`,
    date: "2026-01-05",
    author: "צוות TAXIPRO",
    category: "מדריכים",
    imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80",
    readingTimeMin: 4
  },
  {
    id: "9",
    slug: "taxi-safety-israel",
    title: "אבטחת הנוסע במונית: תכונות האבטחה שלא הכרתם באפליקציות סמארטפון",
    excerpt: "שיתוף נסיעה, נהגים מאומתים ומעקב משפחתי. המונית ממוקדת על אבטחה ב-2026.",
    content: `<h2>תתחילו בהכרה - אתם מעל לכל חשש</h2><p>עידן החוסר ודאות תם. באפליקציית TAXIPRO, כל נהג עובר בקרת אימות (KYC).</p>`,
    date: "2025-12-25",
    author: "דנה רון",
    category: "אבטחה",
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    readingTimeMin: 4
  },
  {
    id: "10",
    slug: "working-as-taxi-driver-2026",
    title: "להיות נהג מונית בעידן הדאטה וה-Big Data - סודות המקצוע",
    excerpt: "שקיפות אלגוריתמית וכלים חינמיים לנהגים שרוצים לייצר את ההכנסה האולטימטיבית דרך האפליקציה.",
    content: `<h2>הלוויתו של הכביש הריק</h2><p>פעם, נהגים ניסו את מזלם באזורי אי-תנועה שקטים.</p>`,
    date: "2025-12-18",
    author: "צוות פיתוח TAXIPRO",
    category: "לנהגים",
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    readingTimeMin: 5
  },
  {
    id: "11",
    slug: "electric-taxis-green-future",
    title: "מוניות חשמליות: האם המהפכה הירוקה תפסח על הכביש הציבורי?",
    excerpt: "מס הרכישה, טעינה ציבורית ב-2026 ואיך זה מתבטא בחווית הנוסע הטהורה.",
    content: `<h2>שתיקה מופתית. מנוע אדיר.</h2><p>מוניות חשמליות כובשות אט אט את ציי החברות.</p>`,
    date: "2025-12-10",
    author: "רועי חזות",
    category: "קיימות",
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    readingTimeMin: 4
  },
  {
    id: "12",
    slug: "air-conditioning-rules-in-taxis",
    title: "השליטה במזגן: מי מחליט כמה קר יהיה במונית שלכם?",
    excerpt: "סוגיה כבדת משקל בקיץ הישראלי: האם אתם כנוסעים יכולים לבקש שינוי טמפרטורה.",
    content: `<h2>שירות הוא מעל הכל</h2><p>בתור נוסעים - השירות פרימיום הוא בשבילכם.</p>`,
    date: "2025-12-01",
    author: "צוות TAXIPRO",
    category: "מדריכים",
    imageUrl: "https://images.unsplash.com/photo-1528629297340-d1d466945cb5?w=800&q=80",
    readingTimeMin: 2
  },
  {
    id: "13",
    slug: "taxi-meter-explained",
    title: "מונה במונית: תורת המספרים מאחורי הקופסה הקטנה",
    excerpt: "הוראות משרד התחבורה קופצות למסך. איך קליאו, מונה דיגיטאלי ומכשיר מסך עובדים.",
    content: `<h2>תשתית המונה - חוק מדינה</h2><p>המונה משקלל פרמטרים על סמך מרחק (GPS + מד אוץ) וכן על זמן.</p>`,
    date: "2025-11-20",
    author: "דנה רון",
    category: "פיננסי",
    imageUrl: "https://images.unsplash.com/photo-1554672408-730436b60dde?w=800&q=80",
    readingTimeMin: 3
  },
  {
    id: "14",
    slug: "the-hidden-taxi-fees",
    title: "איך תימנעו מעמלות מוניות חבויות?",
    excerpt: "מזוודות, המתנה ארוכה ועגלת תינוק - על מה אסור לחייב בתחבורה ציבורית של מונית.",
    content: `<h2>חובת ידיעת החוק</h2><p>משרד התחבורה עורך רענון מפליא.</p>`,
    date: "2025-11-15",
    author: "אמיר כץ",
    category: "צרכנות",
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    readingTimeMin: 4
  },
  {
    id: "15",
    slug: "traveling-with-pets-taxis",
    title: "נוסעים עם בעלי חיים במונית? ככה תעשו את זה נכון",
    excerpt: "מכלב נחייה עד לכלב צעצוע – מה מותר להעלות בקבינת הנוסעים.",
    content: `<h2>חיות שירות וחוק עזר</h2><p>כלבי נחייה עולים חינם ואין זכות לנהג לסרבם לעולם!</p>`,
    date: "2025-11-05",
    author: "דנה רון",
    category: "מדריכים",
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    readingTimeMin: 2
  },
  {
    id: "16",
    slug: "app-performance-design-ui-ux",
    title: "מאחורי הקלעים: איך עיצוב UX מהפכני (UI) מוריד לחץ למשתמשי אפליקציה",
    excerpt: "החלקות גלויות לעין (Liquid Swipe) רדאר חסין טעויות (Radar) וכל טכנולוגיית הקצה מאחורי המוצר שלנו.",
    content: `<h2>עיצוב אינו רק אסתטיקה</h2><p>בפיתוח ממשק TaxiAPP השתמשנו בסקיילינג של Framer Motion.</p>`,
    date: "2025-10-30",
    author: "צוות פיתוח TAXIPRO",
    category: "טכנולוגיה",
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    readingTimeMin: 3
  },
  {
    id: "17",
    slug: "driver-rating-impact",
    title: "איך שיטת הדירוג משנה את אופי שירות הלקוחות במוניות?",
    excerpt: "הדירוג הדדי ומונע אלימות מילולית וזלזול בשני הצדדים של השמשה.",
    content: `<h2>כוחו של כוכב</h2><p>בשירותי כלכלה שיתופית, דירוג של 5-כוכבים הוא מטבע סחיר!</p>`,
    date: "2025-10-25",
    author: "דנה רון",
    category: "צרכנות",
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    readingTimeMin: 2
  },
  {
    id: "18",
    slug: "taxi-company-vs-independent-driver",
    title: "תחנה מסודרת לעומת נהג עצמאי - מה ההבדלים על הכביש?",
    excerpt: "מי אוכף ולמי פונים במקרה של אובדן? האחריות העסקית סביב חברה מאוגדת.",
    content: `<h2>בקרת שירות משולבת</h2><p>ברגע של נסיעה עם עצמאי – איבוד חפץ במונית נסמך על נדיבות.</p>`,
    date: "2025-10-18",
    author: "אמיר כץ",
    category: "צרכנות",
    imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80",
    readingTimeMin: 4
  },
  {
    id: "19",
    slug: "corporate-taxi-solutions",
    title: "פתרונות תחבורה עסקיים: האם תאגידים חוסכים בהסדרי תנועה?",
    excerpt: "חשבון B2B המרכז אלפי נסיעות עובד, שקיפות חשבוניות וביטול קופות קטנות.",
    content: `<h2>סוף עידן הקבלה הידנית במונית</h2><p>שירותים לעסקים מביאים למעמסה אדירה בתנאי איסוף הוצאות.</p>`,
    date: "2025-10-10",
    author: "רועי חזות",
    category: "פיננסי",
    imageUrl: "https://images.unsplash.com/photo-1554672408-730436b60dde?w=800&q=80",
    readingTimeMin: 3
  },
  {
    id: "20",
    slug: "the-biggest-challenges-mobility-2026",
    title: "אתגרי המוביליטי ב-2026: הרכב האוטונומי עוד רחוק, אבל אנחנו קרובים מתמיד",
    excerpt: "מדוע נהגים אנושיים ימשיכו לשרת אותנו עד ל-2030.",
    content: `<h2>המסע אל אוטונומיה רמה 5</h2><p>יכולות המוביליות במדינות צפופות קמות ונופלות על מצבים חריגים לא מתוכנתים.</p>`,
    date: "2025-09-05",
    author: "צוות פיתוח TAXIPRO",
    category: "בינה מלאכותית",
    imageUrl: "https://images.unsplash.com/photo-1621213346995-1f9e23ba8e13?w=800&q=80",
    readingTimeMin: 5
  }
];
