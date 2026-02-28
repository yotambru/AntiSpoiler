# הרצה על אמולטור ובדיקת חסימת ספוילרים

כדי לראות UI אנדרואיד אמיתי ולבדוק שהספוילרים נחסמים, צריך אמולטור (או מכשיר פיזי). הנה הצעדים.

## 1. התקנת Android Studio (פעם אחת)

אם עדיין לא מותקן:

1. הורד את [Android Studio](https://developer.android.com/studio).
2. התקן ופתח את Android Studio.
3. בתפריט **More Actions** בחר **SDK Manager**.
4. וודא ש-**Android SDK Platform** (גרסה 34 או 33) מותקן, ו-**Android SDK Build-Tools** גם.
5. בלשונית **SDK Tools** סמן גם **Android Emulator** ו-**Android SDK Platform-Tools** והתקן.

## 2. יצירת אמולטור (מכשיר וירטואלי)

1. ב-Android Studio: **Tools → Device Manager** (או **More Actions → Virtual Device Manager**).
2. **Create Device**.
3. בחר מכשיר (למשל **Pixel 6** או **Pixel 7**) → **Next**.
4. בחר **System Image** (למשל **Tiramisu** API 33 או **UpsideDownCake** API 34). אם צריך – לחץ **Download** ליד הגרסה.
5. **Next** → **Finish**.

## 3. הרצת האפליקציה על האמולטור

### אפשרות א': מ-Android Studio

1. **File → Open** → בחר את תיקיית `android/` בפרויקט.
2. אחרי סנכרון Gradle: בתפריט המכשירים בחר את האמולטור שיצרת.
3. לחץ **Run** (המשולש הירוק) או **Shift+F10**.
4. האמולטור יעלה והאפליקציה **Anti-Spoiler** תותקן ותיפתח.

### אפשרות ב': מהטרמינל (אחרי ש-Android Studio/SDK מותקן)

```bash
cd android
export ANDROID_HOME=~/Library/Android/sdk   # Mac. ב-Windows: %LOCALAPPDATA%\Android\Sdk
./run-on-emulator.sh
```

הסקריפט יבנה את האפליקציה, יבדוק אם יש AVD, וינסה להפעיל אמולטור ולהתקין את ה-APK. אם אין AVD – תיצור אחד קודם מ-Device Manager.

## 4. הפעלת שירות הנגישות (חובה)

בלי זה החסימה לא תעבוד:

1. באמולטור, פתח את האפליקציה **Anti-Spoiler**.
2. לחץ **"הפעל שירות נגישות"**.
3. ייפתחו **הגדרות → נגישות**. ברשימה מצא **Anti-Spoiler** והפעל את המתג.
4. אם מופיעה אזהרה – אשר (זה נדרש כדי שהשירות יקרא תוכן ויציג overlay).

## 5. בדיקה: לראות שספוילרים נחסמים

### שיטה א': עמוד בדיקה מקומי (מומלץ)

1. במחשב (לא באמולטור), בתיקיית הפרויקט הרץ:
   ```bash
   cd /path/to/AntiSpoiler
   python3 -m http.server 8080
   ```
2. באמולטור, פתח **Chrome** והקלד בכתובת:
   ```
   http://10.0.2.2:8080/android-test-page.html
   ```
   (`10.0.2.2` = המחשב שלך מהצד של האמולטור.)

3. אמור להופיע עמוד עם כותרות וטקסט לבדיקה. הוסף את מילות הבדיקה ("בדיקה-ספויילר-1", "test-spoiler-2", "דוגמה") לרשימה כדי לראות את ה-overlay.
4. **אם השירות מופעל** – האזורים עם המילים האלו ייכוסו ב-overlay סגול/מטושטש.
5. אם **אין** overlay – חזור לשלב 4 וודא ששירות הנגישות של Anti-Spoiler מופעל.

### שיטה ב': חיפוש ברשת

1. באמולטור פתח **Chrome** וגלוש לאתר או חיפוש שמכיל את מילות המפתח שהוספת.
2. בדפים שבהם מופיעות המילים – אמור להופיע overlay מעל התוכן הרלוונטי.

## 6. סיכום

| שלב | מה לעשות |
|-----|----------|
| 1 | התקן Android Studio + SDK + Emulator |
| 2 | צור AVD ב-Device Manager |
| 3 | הרץ את האפליקציה על האמולטור (Studio או `run-on-emulator.sh`) |
| 4 | באפליקציה: "הפעל שירות נגישות" → בהגדרות הפעל את Anti-Spoiler |
| 5 | פתח `http://10.0.2.2:8080/android-test-page.html` ב-Chrome באמולטור (אחרי `python3 -m http.server 8080`) ובדוק ש-overlay מכסה את הספוילרים |

אחרי זה יש לך UI אנדרואיד אמיתי ואתה יכול לסייר באמולטור ולוודא שהספוילרים נחסמים.
