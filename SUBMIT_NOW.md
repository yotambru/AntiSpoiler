# 🚀 Submitting Anti-Spoiler to Chrome Web Store – Step-by-Step

## ✅ What's Already Ready
- [x] ZIP file: `AntiSpoiler-extension-v1.0.0.zip`
- [x] Privacy Policy: `privacy-policy.html`
- [x] Icons (16, 48, 128)
- [x] Screenshot guide: `screenshot-guide.html`

---

## Step 1: Host the Privacy Policy (Required)

Chrome Web Store requires a **URL** to your Privacy Policy, not a local file.

### Option A: GitHub Pages (Recommended)
1. Push the project to GitHub (if not already)
2. Settings → Pages → Source: Deploy from branch
3. Select the branch (e.g. `main`) and folder `/` or `root`
4. The URL will be: `https://[username].github.io/AntiSpoiler/privacy-policy.html`

### Option B: Free Hosting Services
- [Netlify Drop](https://app.netlify.com/drop) – Drag and drop `privacy-policy.html`
- [Surge.sh](https://surge.sh) – Run `surge privacy-policy.html`
- [GitHub Gist](https://gist.github.com) – Upload as HTML and create a raw link

**Save the URL** – you will need it in the form.

---

## Step 2: Screenshots

1. Open `screenshot-guide.html` in your browser
2. Capture at least one screenshot (3 recommended):
   - Extension popup
   - Example of blocked content
3. Save as PNG, recommended size 1280×800

---

## Step 3: Developer Registration

1. Go to: **https://chrome.google.com/webstore/devconsole**
2. Sign in with your Google account
3. Pay the **one-time $5 fee** (lifetime registration)

---

## Step 4: Upload the Extension

1. In the Dashboard: **New Item**
2. Upload: `AntiSpoiler-extension-v1.0.0.zip`
3. Fill in the fields:

| Field | Value |
|-------|-------|
| **Name** | Anti-Spoiler |
| **Summary** | Blocks spoilers - add your own keywords to filter content across all websites |
| **Description** | Extension that automatically blocks spoiler content based on your custom keywords across all websites. Features: Add your own keywords (sports, TV, movies), works on all sites, detects dynamic content, easy on/off, Hebrew & English support. |
| **Category** | Productivity |
| **Language** | English, Hebrew |
| **Privacy Policy URL** | [The URL you created in Step 1] |
| **Single purpose** | Yes |

4. Upload screenshots (at least 1)
5. **Host permissions**: Explanation: "Needed to scan and block spoiler content on all websites"

---

## Step 5: Submit for Review

Click **Submit for Review**. Typically 1–3 business days.

---

## Useful Links
- [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
