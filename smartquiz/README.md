# SmartQuiz — Smart Exam Studio

SmartQuiz turns a PDF, phone photo, or handwritten question paper into a timed online MCQ exam. Teachers build and publish papers; students join with a six-character code, sit the timer, and get an instant mark.

Developed by **Bibek Singh**.

The project is a **Vite + React + TypeScript** web app. It is also a **Progressive Web App (PWA)**, so it can be installed on Android, iPhone/iPad, Windows, and macOS from the browser — no separate app-store package is required.

## Hosted copy and downloads

- **Hosted copy:** <https://quizpaper-dqm3n3jywre.qoder.website>
- **Source for GitHub + Vercel:** <https://quizpaper-dqm3n3jywre.qoder.website/smartquiz-source-github-vercel.zip> — every file sits at the archive root, so `package.json` and `src/` are visible immediately after extraction. Extract it straight into the repository root; do not add another folder level.
- **Prebuilt static site:** <https://quizpaper-dqm3n3jywre.qoder.website/smartquiz-deploy.zip> — root contains `index.html` and `assets/`; upload that root, not its parent folder.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

Production build:

```bash
npm run build
```

The complete static site is written to `dist/`.

## Push to GitHub and deploy with Vercel

1. Create a new repository on GitHub.
2. Extract `smartquiz-source-github-vercel.zip` and put its **contents** in the repository root. The repository root must directly contain `package.json`, `index.html`, `src/`, `public/`, `vite.config.ts`, `tsconfig.json`, and `vercel.json`. Do not commit `node_modules/` or `dist/`, and do not leave everything inside a `smartquiz/` subfolder.
3. Commit and push.
4. In Vercel, choose **Add New → Project**, import the repository, and deploy.
5. On the import screen, leave **Root Directory** empty (it must point at the folder that contains `package.json`). Vercel reads `vercel.json` and uses:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
6. Open the deployment's production URL, not an old preview URL.

Every push to the production branch creates a new deployment.

### If Vercel shows `404 NOT_FOUND`

That error means Vercel published an empty output folder, not a routing bug. Check these in order:

- **Nested project folder:** open the GitHub repository. If `package.json` is not visible in the root listing (for example it sits inside `smartquiz/`), move the contents up one level, or set Vercel **Root Directory** to `smartquiz` and redeploy.
- **Wrong output directory:** for the source project the output must be `dist`. If the dashboard shows a different value, clear it and redeploy.
- **Prebuilt package deployed as source:** if you uploaded the prebuilt files, do not run `npm run build`; set **Framework Preset: Other**, disable the build command, and set **Output Directory** to the repository root.
- **ZIP uploaded as a single file:** Vercel does not unpack an uploaded ZIP. Push the extracted files to GitHub, or run `vercel` from inside the extracted folder.

Netlify works the same way: import the repository and let `netlify.toml` run `npm run build` and publish `dist`.

## Deploy a prebuilt package

If you do not want to build on the host, download `smartquiz-deploy.zip` and unzip it. Then:

- **Vercel:** push the extracted files to a repository (root must contain `index.html`). On import choose **Framework Preset: Other**, turn off the build command, and set **Output Directory** to `.` (the repository root). Do not select `dist`.
- **Netlify Drop:** open <https://app.netlify.com/drop> and drag the folder whose root contains `index.html` and `assets/`.
- **Any static host:** upload the folder contents, including the `assets/` folder and `.nojekyll`.

The `index.html` in the prebuilt package points to `./assets/...`. Uploading only `index.html`, nesting the files one folder deep, deploying the ZIP itself, or deploying the uncompiled source will produce a 404 or blank page.

## Install as an app

The site must be opened over **HTTPS** (Vercel, Netlify, GitHub Pages, and Qoder Sites all qualify). Browsers do not install apps from `file://` or plain HTTP.

### Android

Open the site in Chrome, then either use the **Install app** button in the top-right header or Chrome’s **⋮ → Install app / Add to Home screen**.

### iPhone and iPad

Open the site in **Safari**, tap **Share**, choose **Add to Home Screen**, then tap **Add**. iOS installs web apps from Safari’s share menu rather than an in-page prompt.

### Windows and macOS

- **Chrome / Edge:** click the install icon in the address bar, or open the browser menu and choose **Install SmartQuiz**.
- **Safari 17+ on macOS:** choose **File → Add to Dock**.

The installed app opens full-screen with its own icon. The app shell is cached after the first online visit, so the interface can reopen offline; PDF text, photo OCR downloads, and AI review still need their external resources and a connection. Accounts, exams, answers, and marks remain in that browser’s `localStorage`; installing the app does not move them to a server.

### App-store builds

The PWA installs directly on all four platforms. Signed `.apk`, `.ipa`, `.exe`, or `.dmg` packages, Play Store/App Store listings, and native push notifications would require a separate Capacitor or Electron wrapper plus store/developer certificates.

## How to use

- A fresh browser starts with an empty workspace.
- Open **Admin studio** and create the first administrator account. That account claims the local workspace.
- On the admin dashboard, either **Create an exam** or click **Load sample exam**.
- To rename a paper: **Admin studio → Overview → Edit** on the paper card, then change **Exam title** in Step 1. Changes save automatically and appear on the student exam card.
- To schedule a paper: in Step 1, set an optional **Exam window** with open and close date-times (shown in the viewer's local time). Publish it. Students see it immediately under **Scheduled exams** and the Start button unlocks automatically when the window opens; attempts started near the close time are capped at the closing time.
- Sign out, then create a student account and open the **Student exam hall**. Enter the six-character code from the exam card or share link to start.
- Forgot a password? Choose **Forgot password?** on the sign-in form, enter the account email or any-country phone number, then use the one-time code shown on screen to set a new password.
- Open **Profile** from the account chip to see your SmartQuiz ID card, roll number, member details, and live exam record. Upload a photo (JPG, PNG, WEBP or GIF), edit your display name, and save.
- Administrators can open **Students** in the sidebar for the enrolled-users directory: search by name, roll number, email or phone, filter by exam activity, open a full student profile, and export the register as CSV.

### Profiles, roll numbers and the student directory

Every account receives a permanent roll number when it is created: `SQ-STU-YYYY-0001` for students and `SQ-EXM-YYYY-0001` for examiners. The photo and display name can be changed from the profile page; email, phone and password stay fixed unless recovered through the sign-in flow.

The **Students** page in the admin studio counts how many students have enrolled in this browser and lists each account with its contact details, join date, last sign-in, attempts and average score. **Export CSV** downloads the same register for a spreadsheet. Because the workspace is browser-local, this directory lists only accounts created in that browser; it is not a global cross-device user list.

### Why a student may not see an exam

Accounts, drafts, published papers, attempts, and marks are stored in the **browser profile where they were created**. A student on another phone, another browser, incognito mode, or a different deployment URL sees a separate empty workspace. This is intentional for the backend-free, browser-local build.

Within the same browser:

- A **Draft** paper is hidden from students — open it and use **Review & publish → Publish exam**.
- A **Scheduled** paper appears under **Coming up → Scheduled exams** until its opening time.
- A **Closed** paper stays visible under **Closed exams** for reference; a student who already has a result can open it with **View result**. The **Start exam** action is disabled because the exam window has ended.
- Make sure the admin and student are using the same site address; a new Vercel preview URL is a different origin with separate storage.

Sharing one exam across different devices requires a backend (shared database and real server-side accounts). The current version does not include one.

## Accounts and authorization

SmartQuiz has two roles with separate areas:

- **Administrator / teacher** — the teacher-examiner role. It creates, edits, publishes, and reviews papers. The first administrator account claims the workspace; one administrator account is allowed per browser workspace, and further admin registrations are blocked.
- **Student** — joins published exams with a code and sees only their own attempts and marked papers. Attempts and results are linked to the signed-in student account.

Registration asks for a full name, email address (Gmail works), and a phone number with any country calling code. The sign-in page shows both sides explicitly — **Student** and **Teacher / Examiner** — and each account is created and signed in on its own side, so the selected side sets the destination after sign-in. Sign-in accepts either the email address or the phone number, plus the password. Phone numbers are validated and normalized with libphonenumber-js. A wrong-role visit to the other panel shows a 403 page; authorization is enforced by route guards, not only by hiding links. A signed-out visitor who opens an exam link is sent to sign-in as a student, then returned to the exam after signing in.

Passwords are salted and hashed with PBKDF2-HMAC-SHA-256 (210,000 iterations) in the browser before storage; plaintext passwords are never written to storage. The signed-in session is kept in `sessionStorage` for the current tab.

### Forgot password and OTP recovery

**Forgot password?** on the sign-in form works for administrator, teacher, and student accounts:

1. Enter the email address or any-country phone number saved on the account. It must already exist in this browser workspace.
2. Enter the six-digit one-time code. Codes are single-use, expire after 10 minutes, allow five attempts, and can be reissued after a 30-second cooldown.
3. Set a new password with a fresh PBKDF2 salt and hash. The old password stops working immediately.

The reset challenge lives in `sessionStorage`; only a salted SHA-256 hash of the code is stored, never the code itself. The new password uses the same 210,000-iteration PBKDF2 policy as registration.

**Security boundary:** this is a backend-free, browser-local build, not a production identity system. Email addresses and phone numbers are validated but **not verified** — no email or SMS is sent. The one-time code is shown on screen under **Recovery code**, so this flow cannot prove ownership of the contact. A visitor who controls browser developer tools can alter local data, and real Google OAuth, email or SMS OTP delivery, shared exams across devices, and tamper-proof server-side marking require a backend and provider credentials. Use a password you do not reuse elsewhere.

## Question paper and response review

Admin review has two layers:

- **On-device checks** run offline and immediately. The paper check looks for missing keys, duplicate options, weak or repeated distractors, answer-key skew, unusual time limits, and missing instructions. After submissions arrive, the response check reports per-question correct rate, option spread, skipped answers, and separation between the question and the total score.
- **Optional AI review** uses your own OpenAI-compatible endpoint: OpenAI, OpenRouter, Groq, Ollama, or a custom Chat Completions URL. Open **AI paper check** in the builder's Review step, or **AI response review** on the results page, then connect a provider.

The AI API key is kept in `sessionStorage` for the current tab only. It is never written to `localStorage`, never included in exports, and sent only to the endpoint you configure. Without a key, every local check still works. AI suggestions are advisory; verify any suggested answer key against the source paper.

Static hosting calls the provider directly from the browser, so the endpoint must allow CORS. An HTTPS hosted page cannot reach a local `http://localhost` Ollama endpoint; run Ollama with `OLLAMA_ORIGINS` set if you use a local development server.

## Note on OCR

PDF text is read locally. Photos and handwritten pages use Tesseract.js; the English language data downloads once from its CDN on first use. Clear print works best, and handwriting should always be reviewed.

## Project structure

```
src/            React pages, data store, and components
public/         PWA manifest, service worker, and icons
index.html      App entry, manifest and home-screen metadata
vercel.json     Vercel build settings
netlify.toml    Netlify build settings
```
