# 📚 AssignTrack — Student Assignment Management System

AssignTrack is a full-stack web app that lets faculty upload assignments, track student submissions by section, and grade work — while students register, view assignments, and check their submission status. Built with Node.js, Express, MongoDB, and vanilla JS on the frontend.

---

## 👥 Roles

AssignTrack has two user roles, chosen via a toggle on the login/register page:

| Role | Dashboard | What they do |
|------|-----------|---------------|
| **Student** | `student.html` | Register with academic details (section, CPI, roll number, year, semester, branch), log in, view assigned work, and track their own submission status. |
| **Faculty (Teacher)** | `teacher.html` | Register with subject taught, log in, upload/manage assignments, browse students by section, track submissions across the class, and grade work. |

The role picked at registration is stored on the user and determines which dashboard they're redirected to after login (`server.js`'s session data includes `role`, and `login.html`'s `handleSubmit()` redirects to `/teacher.html` or `/student.html` accordingly).

---

## ✨ Features

**Faculty**
- Upload assignments with title, subject, deadline, priority, and instructions
- Target assignments to a specific section or all sections (with manual "type your own" entry if a section isn't in the dropdown)
- View all students grouped by section, with average CPI and submission stats
- Sort/filter students by CPI range, name, or submission count
- Submission tracker table across all assignments and students
- Grade and leave remarks on individual submissions
- View a detailed profile for any student (info, stats, per-assignment submission history)
- Editable faculty profile with photo, theme, and details

**Students**
- Register with section, CPI/CGPA, roll number, year, semester, and branch (manual "type your own" entry for section/year if not listed)
- Login / Register with role toggle (Student / Faculty)
- Forgot-password flow with emailed reset link (expires after 1 hour)

**System**
- Session-based authentication (stored in MongoDB via `connect-mongo`)
- Password hashing (bcrypt, via a pre-save hook on the User model)
- Daily cron job (8 AM) emailing each student a digest of their still-pending assignments
- Transactional emails (new assignment, deadline digest, password reset) via Nodemailer

---

## 🛠 Tech Stack

| Layer     | Tech |
|-----------|------|
| Backend   | Node.js, Express |
| Database  | MongoDB (Atlas), Mongoose |
| Sessions  | express-session + connect-mongo |
| Email     | Nodemailer (Gmail SMTP) |
| Scheduling| node-cron |
| Frontend  | HTML, CSS, vanilla JavaScript (no framework) |

---

## 📁 Project Structure

```
assignment-tracker/
├── backend/
│   ├── middleware/
│   ├── models/
│   │   ├── Assignment.js
│   │   └── user.js
│   ├── node_modules/
│   ├── routes/
│   │   ├── assignment.js
│   │   ├── auth.js
│   │   └── student.js
│   ├── uploads/
│   ├── utils/
│   │   └── email.js
│   ├── .env                 # not committed — see setup below
│   ├── package.json
│   └── server.js
└── frontend/
    ├── index.html            # redirects to login.html
    ├── login.html            # login / register / forgot password
    ├── teacher.html
    ├── teacher.js
    ├── student.html
    ├── student.js
    ├── profile.js
    ├── reset-password.html
    ├── style.css
    └── script.js
```

---

## ⚙️ Setup

### 1. Clone and install

```bash
cd assignment-tracker/backend
npm install
```

### 2. Create your `.env` file

Create `backend/.env` (this file is **not** committed to version control — see `.gitignore` note below):

```dotenv
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.pwrsjc2.mongodb.net/assigntrack?retryWrites=true&w=majority
SESSION_SECRET=<a-long-random-string>
PORT=3000

EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-16-character-gmail-app-password
```

**Getting `MONGO_URI`:** create a free cluster at [MongoDB Atlas](https://cloud.mongodb.com), add a database user under **Database Access**, and copy the connection string from **Connect → Drivers**.

**Getting `EMAIL_PASS`:** Gmail requires an **App Password**, not your normal login password:
1. Go to `myaccount.google.com/security`
2. Turn on **2-Step Verification** (add a phone number if it's not fully set up — passkeys alone aren't enough to unlock App Passwords)
3. Go to `myaccount.google.com/apppasswords`
4. Name it (e.g. "AssignTrack"), click Create
5. Copy the 16-character code (no spaces) into `EMAIL_PASS`

> If your Google account restricts App Passwords entirely, use a separate Gmail account created just for sending, or swap the transporter in `utils/email.js` for a service like [Brevo](https://brevo.com) (free SMTP relay, no App Password required).

### 3. Run the server

```bash
node server.js
```

You should see:
```
✅ AssignTrack server running at http://localhost:3000
📧 Email: your-gmail-address@gmail.com
✅ MongoDB connected!
```

### 4. Open the app

Go to **`http://localhost:3000/login.html`** in your browser.

> ⚠️ Always access the app through this URL (served by Express), not by double-clicking the HTML file directly. Opening it as a `file://` path breaks every API call, since they use relative paths like `/auth/login`.

---

## 🔑 Core Flows

**Register → Login**
Pick Student or Faculty, fill out the Register tab, then log in from the Login tab. Students are redirected to `student.html`, faculty to `teacher.html`.

**Forgot Password**
Login tab → "Forgot password?" → enter registered email → check inbox for a reset link → set a new password on `reset-password.html`. The reset token expires after 1 hour.

**Uploading an assignment (faculty)**
Assignments panel → fill the form → optionally target a specific section (or type one manually via "Other") → Upload. Students in that section are tracked against it automatically.

**Grading (faculty)**
Submission Tracker panel → click "Grade" on any submitted assignment → enter grade + remarks → Save.

---

## 🔒 Security Notes

- Never commit `.env` — make sure it's listed in `.gitignore`
- Rotate your MongoDB password immediately if it's ever pasted anywhere outside your own machine (chat, GitHub, etc.)
- Session cookies are used for auth; `SESSION_SECRET` should be a long random string, not a guessable phrase
- Passwords are hashed before storage — never stored in plaintext

---

## 🚀 Deploying (future step)

Not covered in this README yet — broadly involves hosting `backend/` on a platform like Render or Railway, setting the same `.env` variables as environment variables on that platform, and updating MongoDB Atlas's **Network Access** to allow connections from your host.

## Author
Priyanka Roy & Raksha Verma