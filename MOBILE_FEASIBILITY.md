# הערכת ישימות: הפיכת Anti-Spoiler לאפליקציית מובייל

## סיכום המנגנון הנוכחי

ההרחבה הנוכחית עובדת כ-**Content Script** בדפדפן Chrome:
- מחפשת מילות מפתח בטקסט ובתכונות אלמנטים (alt, title, aria-label)
- מסתירה אלמנטים עם blur ו-background gradient
- בודקת תאריכים כדי לחסום רק תוכן אחרי תאריך מסוים
- משתמשת ב-MutationObserver לתוכן דינמי
- משתמשת ב-Wikidata API ו-OpenAI API למציאת מילים דומות

## פתרון מוצע: Accessibility Service (Android) ✅

### איך זה עובד?

בדיוק כמו Content Script בדפדפן, אבל ברמת מערכת ההפעלה:

1. **קריאת תוכן מכל האפליקציות**:
   - `AccessibilityService` יכול לקרוא טקסט מכל אפליקציה על המסך
   - עובד על פייסבוק, טוויטר, אינסטגרם, Chrome, Safari - הכל!
   - משתמש ב-`AccessibilityNodeInfo` כדי לגשת לתוכן הטקסט

2. **זיהוי מילות מפתח**:
   - עובר על כל ה-nodes על המסך
   - בודק אם הטקסט מכיל את המילות המפתח
   - בדיוק כמו `content.js` עושה בדפדפן!

3. **הצגת Overlay**:
   - יוצר overlay (שכבה מעל) עם blur/cover
   - מכסה את האזורים שמכילים את המילות האסורות
   - משתמש ב-`WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY`

### יתרונות

✅ **עובד על כל האפליקציות** - פייסבוק, טוויטר, אינסטגרם, Chrome, Safari, הכל!
✅ **אוטומטי** - לא צריך לשתף קישורים או להשתמש בדפדפן מותאם
✅ **דומה מאוד לקוד הקיים** - אותו לוגיקה של חיפוש מילות מפתח
✅ **תמיכה בתאריכים** - יכול לבדוק מתי התוכן נוצר (אם זמין)

### מגבלות

⚠️ **Android בלבד** - iOS לא תומך בזה (ראה למטה)
⚠️ **הרשאות נגישות** - המשתמש צריך להפעיל את שירות הנגישות ידנית
⚠️ **לא כל הטקסט נגיש** - תוכן בתמונות או custom views לא תמיד נגיש
⚠️ **ביצועים** - צריך להיות יעיל כדי לא להאט את המכשיר

## Android: Accessibility Service - פירוט טכני

### איך זה עובד

```kotlin
class AntiSpoilerAccessibilityService : AccessibilityService() {
    
    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        // כשהתוכן משתנה על המסך
        val rootNode = rootInActiveWindow ?: return
        
        // עובר על כל ה-nodes ומחפש מילות מפתח
        traverseAndFilter(rootNode)
    }
    
    fun traverseAndFilter(node: AccessibilityNodeInfo) {
        val text = node.text?.toString() ?: ""
        
        // בודק אם הטקסט מכיל מילות מפתח (כמו content.js)
        if (containsKeywords(text)) {
            val bounds = Rect()
            node.getBoundsInWindow(bounds)
            
            // יוצר overlay עם blur/cover מעל האזור
            showOverlay(bounds)
        }
        
        // עובר על כל הילדים
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { traverseAndFilter(it) }
        }
    }
    
    fun showOverlay(bounds: Rect) {
        val overlayView = View(this).apply {
            background = GradientDrawable().apply {
                // אותו gradient כמו ב-CSS!
                colors = intArrayOf(
                    Color.parseColor("#667eea"),
                    Color.parseColor("#764ba2")
                )
            }
            // אפשר להוסיף blur כאן
        }
        
        val params = WindowManager.LayoutParams(
            bounds.width(),
            bounds.height(),
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            x = bounds.left
            y = bounds.top
        }
        
        windowManager.addView(overlayView, params)
    }
}
```

### מה צריך לעשות

1. **יצירת AccessibilityService**:
   - יוצר service שיורש מ-`AccessibilityService`
   - מגדיר ב-`AndroidManifest.xml` עם הרשאות נגישות

2. **קריאת תוכן**:
   - משתמש ב-`onAccessibilityEvent()` כדי לקבל עדכונים כשהתוכן משתנה
   - עובר על `AccessibilityNodeInfo` tree כדי למצוא טקסט

3. **הצגת Overlay**:
   - יוצר View עם blur/cover
   - מוסיף אותו עם `WindowManager` מסוג `TYPE_ACCESSIBILITY_OVERLAY`

4. **ניהול מילות מפתח**:
   - יכול להשתמש באותו לוגיקה כמו `content.js`
   - שמירה ב-`SharedPreferences` (במקום `chrome.storage.local`)

### דרישות טכניות

- **Android API Level**: 21+ (Android 5.0+)
- **הרשאות**: `BIND_ACCESSIBILITY_SERVICE`
- **הגדרות**: המשתמש צריך להפעיל את השירות ידנית ב-Settings → Accessibility

### מדיניות Google Play

⚠️ **חשוב**: Google Play דורש שאפליקציות שמשתמשות ב-Accessibility Service:
- יסבירו בבירור למה זה נחוץ
- ישמשו את זה רק למטרות נגישות או פילטור תוכן לגיטימי
- לא ישתמשו בזה למטרות זדוניות (phishing, tap-jacking וכו')

**החדשות הטובות**: אפליקציית Anti-Spoiler היא בדיוק המקרה השימושי הלגיטימי!

## iOS: אין פתרון דומה ❌

### למה לא?

iOS **לא מאפשר** לאפליקציות של צד שלישי:
- לקרוא תוכן מאפליקציות אחרות
- ליצור overlay מעל אפליקציות אחרות
- לגשת ל-UI hierarchy של אפליקציות אחרות

### מה כן אפשר ב-iOS?

1. **דפדפן מותאם אישית** (כמו שדיברנו קודם)
   - רק בתוך האפליקציה שלך
   - לא עובד על פייסבוק, טוויטר וכו'

2. **Safari Content Blocker**
   - רק URL patterns
   - לא יכול לבדוק תוכן עמוד

**מסקנה**: ב-iOS אין דרך לעשות את זה על כל האפליקציות.

## השוואה: Web Extension vs Mobile App

| תכונה | Web Extension (כרגע) | Android Accessibility | iOS |
|-------|----------------------|---------------------|-----|
| עובד על כל האפליקציות | ✅ (דפדפנים) | ✅ (כל האפליקציות!) | ❌ |
| עובד על פייסבוק | ❌ | ✅ | ❌ |
| עובד על טוויטר | ❌ | ✅ | ❌ |
| עובד על אינסטגרם | ❌ | ✅ | ❌ |
| אוטומטי | ✅ | ✅ | ❌ |
| לא צריך דפדפן מותאם | ✅ | ✅ | ❌ |

## הערכת קושי טכני

### Android (Accessibility Service):
- **קושי**: בינוני-גבוה
- **זמן פיתוח משוער**: 3-4 שבועות
- **טכנולוגיות**: Kotlin/Java, AccessibilityService API, WindowManager
- **אתגרים**:
  - צריך לטפל ב-performance (לא להאט את המכשיר)
  - צריך לטפל ב-scrolling ו-dynamic content
  - צריך לטפל ב-overlay positioning

### iOS:
- **קושי**: לא אפשרי ❌
- **זמן פיתוח**: אין פתרון

## שלבי פיתוח מוצעים (Android)

### שלב 1: Proof of Concept (1 שבוע)
- [ ] יצירת AccessibilityService בסיסי
- [ ] קריאת טקסט מהמסך
- [ ] זיהוי מילות מפתח בסיסי
- [ ] הצגת overlay פשוט

### שלב 2: פיתוח מלא (2-3 שבועות)
- [ ] אינטגרציה עם לוגיקת המילות מפתח הקיימת
- [ ] תמיכה בתאריכים (אם אפשר)
- [ ] UI להגדרות (מילות מפתח, הפעלה/כיבוי)
- [ ] ניהול overlay (הסרה, עדכון)
- [ ] אופטימיזציה לביצועים

### שלב 3: בדיקות ואופטימיזציה (1 שבוע)
- [ ] בדיקות על מכשירים שונים
- [ ] בדיקות על אפליקציות שונות (פייסבוק, טוויטר וכו')
- [ ] אופטימיזציה לביצועים
- [ ] טיפול בבעיות edge cases

## הערות חשובות

1. **הרשאות נגישות**: המשתמש יצטרך להפעיל את השירות ידנית ב-Settings → Accessibility
2. **תאימות קוד**: רוב הלוגיקה של חיפוש מילות מפתח יכולה להיות מועברת ישירות
3. **APIs חיצוניים**: Wikidata ו-OpenAI APIs יעבדו באותה צורה
4. **Storage**: צריך להתאים את `chrome.storage.local` ל-`SharedPreferences`
5. **ביצועים**: צריך להיות זהיר לא להאט את המכשיר - אולי להשתמש ב-throttling

## סיכום

### Android: ✅ אפשרי מאוד!

**הישימות: גבוהה מאוד** ✅

- עובד על **כל האפליקציות** (פייסבוק, טוויטר, אינסטגרם, Chrome וכו')
- דומה מאוד למנגנון הקיים בדפדפן
- **זמן פיתוח משוער**: 3-4 שבועות
- **רמת קושי**: בינוני-גבוה

### iOS: ❌ לא אפשרי

- אין API ציבורי שמאפשר overlay על אפליקציות אחרות
- אין דרך לקרוא תוכן מאפליקציות אחרות
- הפתרון היחיד הוא דפדפן מותאם אישית (לא עובד על פייסבוק/טוויטר)

## המלצה

**להתחיל עם Android** - זה הפתרון הכי קרוב למה שיש כרגע בדפדפן, ועובד על כל האפליקציות!

אם תרצה, אני יכול להתחיל ליצור Proof of Concept לאנדרואיד עם AccessibilityService.
