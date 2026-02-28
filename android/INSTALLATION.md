# הוראות התקנה - Anti-Spoiler Android

## דרישות מקדימות

1. **Android Studio** - Arctic Fox או חדש יותר
2. **JDK 8+** - Java Development Kit
3. **מכשיר אנדרואיד** או **אמולטור** עם Android 5.0+ (API Level 21+)

## התקנה

### שלב 1: פתיחת הפרויקט

1. פתח את Android Studio
2. בחר **File → Open**
3. בחר את התיקייה `android/` בתוך הפרויקט
4. המתן עד ש-Gradle מסיים לסנכרן

### שלב 2: הגדרת Gradle

אם יש שגיאות Gradle:
1. **File → Sync Project with Gradle Files**
2. אם עדיין יש בעיות, נסה **File → Invalidate Caches / Restart**

### שלב 3: הרצה על מכשיר

#### אפשרות א': מכשיר פיזי

1. הפעל **Developer Options** במכשיר:
   - לך ל-**Settings → About Phone**
   - לחץ 7 פעמים על **Build Number**
   - חזור ל-**Settings** ותראה **Developer Options**

2. הפעל **USB Debugging**:
   - לך ל-**Settings → Developer Options**
   - הפעל **USB Debugging**

3. חבר את המכשיר למחשב עם כבל USB

4. ב-Android Studio, לחץ על **Run** (Shift+F10) או **Run 'app'**

#### אפשרות ב': אמולטור

1. ב-Android Studio, לחץ על **Device Manager**
2. לחץ על **Create Device**
3. בחר מכשיר ו-Android version (5.0+)
4. לחץ **Finish**
5. הרץ את האפליקציה על האמולטור

### שלב 4: הפעלת שירות נגישות

**חשוב**: האפליקציה לא תעבוד עד שתפעיל את שירות הנגישות ידנית!

1. פתח את האפליקציה **Anti-Spoiler** במכשיר
2. לחץ על **"הפעל שירות נגישות"**
3. תועבר אוטומטית להגדרות נגישות
4. מצא את **"Anti-Spoiler"** ברשימה
5. הפעל את המתג
6. אשר את ההרשאות (אם נדרש)

### שלב 5: בדיקה

1. פתח אפליקציה כלשהי (פייסבוק, טוויטר, Chrome וכו')
2. חפש תוכן שמכיל את מילות המפתח שהוספת
3. התוכן אמור להיות מוסתר עם overlay סגול עם blur

## פתרון בעיות

### האפליקציה לא חוסמת תוכן

1. ודא ששירות הנגישות מופעל:
   - לך ל-**Settings → Accessibility**
   - ודא ש-**Anti-Spoiler** מופעל

2. ודא שהאפליקציה מופעלת:
   - פתח את האפליקציה
   - ודא שהסטטוס מציג "שירות נגישות מופעל ✅"

3. נסה לסגור ולפתוח מחדש את האפליקציה שבה אתה מחפש תוכן

### שגיאת Build

אם יש שגיאות build:
1. ודא ש-Android SDK מותקן:
   - **Tools → SDK Manager**
   - ודא ש-Android SDK Platform 34 מותקן

2. נקה את הפרויקט:
   - **Build → Clean Project**
   - **Build → Rebuild Project**

### Overlay לא מוצג

1. ודא שהמכשיר תומך ב-overlay:
   - Android 5.0+ נדרש
   - בדוק שהאפליקציה לא חסומה על ידי אפליקציות אחרות

2. בדוק הרשאות:
   - **Settings → Apps → Special Access → Display over other apps**
   - ודא ש-**Anti-Spoiler** מופעל

## מבנה הפרויקט

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/antispoiler/app/
│   │   │   ├── AntiSpoilerAccessibilityService.kt  # השירות הראשי
│   │   │   ├── MainActivity.kt                      # מסך ההגדרות
│   │   │   └── KeywordsAdapter.kt                   # רשימת מילות מפתח
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   └── item_keyword.xml                # פריט מילת מפתח
│   │   │   ├── xml/
│   │   │   │   └── accessibility_service_config.xml
│   │   │   └── values/
│   │   │       ├── strings.xml
│   │   │       ├── colors.xml
│   │   │       └── themes.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## פיתוח עתידי

- [ ] תמיכה בתאריכים (לחסום רק תוכן אחרי תאריך מסוים)
- [ ] שיפור ביצועים (throttling, caching)
- [ ] UI משופר עם Material Design
- [ ] תמיכה ב-Wikidata API למציאת מילים דומות
- [ ] תמיכה ב-OpenAI API (אם המשתמש מגדיר API key)

## הערות

- השירות צריך להיות מופעל ידנית בהגדרות נגישות
- לא כל הטקסט נגיש (תוכן בתמונות או custom views לא תמיד נגיש)
- Overlay יכול להשפיע על ביצועים - צריך להיות זהיר עם אופטימיזציה
