# מסע חכם בגלקסיה — Mechonan Galaxy

משחק PWA בעברית RTL להכנה למבחן המחוננים שלב ב' לבן 9.5.
משחק חלל בסגנון Galaxy Attack עם שכבת ידע: שלבי ירי, שדרוגים על תשובות נכונות, מבחני בוס כל 10 שלבים, סימולציה מלאה בשלב 100.

## כללי ברזל

### 1. שפה ועברית
- כל הטקסט המופנה למשתמש בעברית בלבד
- RTL מלא, פונט נעים לילדים (Heebo / Rubik / Assistant)
- שמות זהויות (משתנים, פונקציות, קבצים) באנגלית

### 2. אסור window.alert / confirm / prompt
- כל דיאלוג חייב להיות overlay מותאם (`src/ui/modal.js`)
- מטעמי UX (RTL, עיצוב) ובדיקות עתידיות

### 3. ארכיטקטורה — תוכן מ-JSON, לא מקוד
- שאלות, נשקים, אויבים, שלבים — **כולם** ב-JSON
- הוספת תוכן עתידי = עריכת JSON, אפס שינויי קוד
- Schema validation בעת הטעינה (sanity checks)

### 4. Offline-first
- PWA מלאה, service worker, cache strategy
- localStorage לשמירת התקדמות
- כל הנכסים (תמונות, סאונד) מקומיים

### 5. Vanilla, ללא bundler
- ES6 modules נטיביים (`<script type="module">`)
- ללא npm install של תלויות runtime
- ספריות שנדרשות (אם בכלל) מותקנות סטטית ב-`/assets/lib/`

### 6. מבנה תיקיות
```
src/
├── engine/      ← Game class, loop, renderer, input, object pools
├── entities/    ← player, enemy, bullet, asteroid-quiz
├── content/     ← JSONs (questions, weapons, enemies, levels, sprites-meta)
├── ui/          ← screens, overlays, HUD, modals
├── audio/       ← SFX manager
├── store/       ← profiles, progress (localStorage)
└── styles/      ← CSS
assets/          ← sprites, sounds, fonts
_AllFilesApp/    ← קבצים נלווים: סריקות, תוכניות, הערות (לא רץ באפליקציה)
```

### 7. הוספת תוכן (workflow לעתיד)
- שאלות חדשות → `src/content/questions/{topic}.json`
- נשקים חדשים → `src/content/weapons.json`
- אויבים חדשים → `src/content/enemies.json`
- שלבים חדשים → `src/content/levels.json`

### 8. סטטוס שאלות
מסד ראשוני: 117 שאלות מהקבצים הסרוקים של מכון מיחונן (כיתה ב' שלב ב').
מקור הקבצים: `_AllFilesApp/scans/full/` (סריקות מלאות) + `_AllFilesApp/scans/preview/` (קטנות).
**אין להמציא שאלות חדשות** ללא אישור מפורש מהמשתמש.

### 9. מכשירי יעד
- PC Windows (עכבר + מקלדת)
- טאבלט אנדרואיד (מגע)
- העיצוב responsive — מסך-גמיש (משמר יחס מסך הקנבס בלי לחתוך)
