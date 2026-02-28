# Anti-Spoiler Android App

אפליקציית אנדרואיד שמשתמשת ב-AccessibilityService כדי לחסום תוכן ספויילרים בהתאם למילות המפתח שבחרת, בכל האפליקציות.

## תכונות

- ✅ עובד על כל האפליקציות (פייסבוק, טוויטר, אינסטגרם, Chrome וכו')
- ✅ חוסם תוכן אוטומטית עם overlay עם blur/cover
- ✅ תמיכה במילות מפתח מותאמות אישית
- ✅ ממשק משתמש להגדרות

## דרישות

- Android 5.0+ (API Level 21+)
- Android Studio Arctic Fox או חדש יותר
- JDK 8 או חדש יותר

## התקנה

1. פתח את הפרויקט ב-Android Studio
2. סנכרן Gradle files
3. בנה את הפרויקט (Build → Make Project)
4. הרץ על מכשיר או אמולטור

## שימוש

1. פתח את האפליקציה
2. לחץ על "הפעל שירות נגישות"
3. בהגדרות נגישות, הפעל את "Anti-Spoiler"
4. האפליקציה תתחיל לחסום תוכן אוטומטית בכל האפליקציות

## מבנה הפרויקט

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/antispoiler/app/
│   │   │   ├── AntiSpoilerAccessibilityService.kt  # השירות הראשי
│   │   │   ├── MainActivity.kt                     # מסך ההגדרות
│   │   │   └── KeywordsAdapter.kt                  # רשימת מילות מפתח
│   │   ├── res/
│   │   │   ├── xml/
│   │   │   │   └── accessibility_service_config.xml # הגדרות שירות נגישות
│   │   │   └── values/
│   │   │       ├── strings.xml
│   │   │       ├── colors.xml
│   │   │       └── themes.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## איך זה עובד?

1. **AccessibilityService** קורא תוכן מכל האפליקציות על המסך
2. מחפש מילות מפתח בטקסט (כמו `content.js` בדפדפן)
3. יוצר overlay עם blur/cover מעל האזורים שמכילים את המילות האסורות
4. Overlay נעלם כשהתוכן משתנה או כשהמשתמש עוזב את המסך

## הערות חשובות

- השירות צריך להיות מופעל ידנית בהגדרות נגישות
- לא כל הטקסט נגיש (תוכן בתמונות או custom views לא תמיד נגיש)
- Overlay יכול להשפיע על ביצועים - צריך להיות זהיר עם אופטימיזציה

## פיתוח עתידי

- [ ] תמיכה בתאריכים (לחסום רק תוכן אחרי תאריך מסוים)
- [ ] שיפור ביצועים (throttling, caching)
- [ ] UI משופר עם Material Design
- [ ] תמיכה ב-Wikidata API למציאת מילים דומות
- [ ] תמיכה ב-OpenAI API (אם המשתמש מגדיר API key)
