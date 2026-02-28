# Chrome Web Store Publishing Guide

## Step 1: Preparing the Extension for Publishing

### 1.1 Creating Icons
Before publishing, ensure you have 3 icon files:
- `icon16.png` (16×16 pixels)
- `icon48.png` (48×48 pixels)
- `icon128.png` (128×128 pixels)

**Options for creating icons:**
- Open `create-icons.html` in a browser and click each icon to download
- Or run: `python create-icons.py`
- Or create 3 PNG files manually in the required sizes

### 1.2 Testing the Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Load the extension as "Load unpacked"
4. Verify everything works correctly

### 1.3 Creating a ZIP File
1. Ensure all required files are in the folder:
   - manifest.json
   - content.js
   - background.js
   - popup.html, popup.css, popup.js
   - icon16.png, icon48.png, icon128.png
   - game-notification.html, game-notification.js (if required)

2. **Exclude unnecessary files:**
   - Do not include: `.git`, `node_modules`, `README.md`, `INSTALLATION.md`, `CHROME_STORE_GUIDE.md`
   - Do not include: `create-icons.html`, `create-icons.py`, `test-game.js`
   - Do not include: `.DS_Store`, `.gitignore`

3. **Create the ZIP file:**
   ```bash
   # On Mac/Linux:
   cd /path/to/AntiSpoiler
   zip -r AntiSpoiler-extension.zip . -x "*.git*" -x "*node_modules*" -x "*.md" -x "create-icons.*" -x "test-*" -x ".DS_Store"
   ```

   Or use the `prepare-for-store.sh` script:
   ```bash
   bash prepare-for-store.sh
   ```

   Alternatively:
   - Select all required files in the folder
   - Right-click → "Compress" (Mac) or "Send to → Compressed folder" (Windows)

---

## Step 2: Chrome Web Store Developer Account Registration

### 2.1 One-Time Payment
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in with your Google account
3. You will need to pay a **one-time $5 fee** to register as a Developer
   - This is a one-time lifetime payment
   - You get unlimited access to publish extensions

### 2.2 Account Approval
After payment, you will have access to the Chrome Web Store Developer Console.

---

## Step 3: Uploading the Extension

### 3.1 Uploading the File
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **"New Item"**
3. Click **"Upload"**
4. Select the ZIP file you created (`AntiSpoiler-extension-v1.0.0.zip`)
5. Click **"Upload"**

### 3.2 Filling in Extension Details

#### Basic Details:
- **Name**: Anti-Spoiler
- **Summary**: Blocks spoilers - add your own keywords to filter content across all websites
- **Description**:
  ```
  Extension that automatically blocks spoiler content based on your custom keywords across all websites you visit.
  
  Features:
  - Add your own keywords to block (sports, TV shows, movies, etc.)
  - Works on all websites
  - Detects dynamically loaded content
  - Easy on/off toggle
  - Supports Hebrew and English
  
  Perfect for anyone who wants to avoid spoilers!
  ```

#### Category:
- Select: **Productivity** or **Sports**

#### Images:
- **Screenshots**: Upload 1–5 screenshots of the extension in action
  - Recommended size: 1280×800 or 640×400 pixels
  - Capture the popup, example of blocked content, etc.
- **Promotional Images** (optional): Images for store promotion

#### Additional Details:
- **Language**: English (United States) + Hebrew (Israel)
- **Homepage URL** (optional): If you have a website or GitHub repo
- **Support URL** (optional): If you have a support page
- **Privacy Policy**: **Required!**
  - If you don't have a website, create a simple page on GitHub Pages or use a service like [Privacy Policy Generator](https://www.freeprivacypolicy.com/)
  - Your extension uses the `storage` permission, so you need to explain what you store

#### Privacy Settings:
- **Single purpose**: Select "Yes" (the extension does one clear thing)
- **Host permissions**: Explain why you need `<all_urls>`
  - Explanation: "Needed to scan and block spoiler content on all websites"

---

## Step 4: Privacy Policy

**Very important!** Chrome Web Store requires a Privacy Policy.

### Option 1: Creating a Simple Privacy Policy
Create a simple `privacy-policy.html` file (already included in this project).

Upload it to GitHub Pages or any free hosting service, and add the URL to the form.

### Option 2: Using GitHub Pages
1. Create a repo on GitHub
2. Upload `privacy-policy.html`
3. Enable GitHub Pages
4. Use the generated URL

---

## Step 5: Submitting for Review

1. After filling in all fields, click **"Submit for Review"**
2. The review process typically takes **1–3 business days**
3. You will receive an email when the extension is approved or rejected

### If Rejected:
- You will receive a rejection message with explanations
- You will need to fix the issues and resubmit

---

## Step 6: After Approval

1. The extension will appear on the Chrome Web Store
2. Users will be able to search for it and find it
3. You can share the direct link

### Share Link:
After publishing, you will get a link like:
```
https://chrome.google.com/webstore/detail/[extension-id]
```

---

## Important Tips

1. **Ensure everything works** before submitting for review
2. **Privacy Policy is required** – don't skip it
3. **Screenshots help a lot** – users want to see what the extension does
4. **Detailed description** – explain clearly what the extension does and who it's for
5. **Updates** – if you update the extension in the future, you can upload a new version through the same Dashboard

---

## Costs

- **Developer registration**: $5 one-time
- **Publishing extensions**: Free (unlimited)
- **Updates**: Free

---

## Additional Help

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Chrome Web Store Developer Support](https://support.google.com/chrome_webstore/)

---

**Good luck with the publishing! 🚀**
