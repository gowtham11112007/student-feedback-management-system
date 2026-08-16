# Student Feedback Management System 🎓

A full-stack, responsive web application for collecting, analyzing, and managing student feedback in academic institutions. Built with a **Python Flask REST API**, **SQLite (Flask-SQLAlchemy)** database, **Vanilla HTML/CSS/JS** frontend, and optimized for **Vercel Serverless** deployment.

---

## ✨ Key Features

### 1. Student Feedback Form (Public Portal)
- **Comprehensive Input Fields**: Student Name, Roll Number / Student ID, Department, Course/Subject, Category (Teaching, Facilities, Curriculum, Other), Interactive 5-Star Rating, Feedback Message, and auto-filled Submission Date.
- **Interactive 5-Star Rating Control**: Visual star hover and selection feedback with descriptive rating labels.
- **Client-Side & Server-Side Validation**: Dynamic error highlights and message checks prior to submission.
- **Async API Submission**: Submits feedback via `fetch()` to `POST /api/feedback`.
- **User Feedback**: Dynamic success modal with feedback receipt summary and toast notifications.

### 2. Admin Dashboard & Analytics (Protected Portal)
- **JWT Admin Authentication**: Secure login flow using JWT stored in `localStorage`.
- **Live Summary Cards**: Total Feedbacks, Average Satisfaction Rating (out of 5 stars), Pending Reviews count, and Reviewed items count.
- **Visual Analytics Cards**:
  - **Department Performance**: Satisfaction rating averages (1-5) and submission volume with visual progress bars.
  - **Category Breakdown**: Distribution chips showing total counts per feedback category.
- **Search, Filter & Sort Bar**:
  - **Search**: Live debounced search across student names, roll numbers, course names, and message content.
  - **Filters**: Instant dropdown filtering by Department, Category, Rating, and Status (Pending / Reviewed).
  - **Sorting**: Order entries by Newest/Oldest date, Highest/Lowest rating, or Student Name (A-Z).
- **Data Table Actions**:
  - **Toggle Status**: Instant one-click status toggle between *Pending* and *Reviewed*.
  - **Detail Modal**: View full student message and submission details.
  - **Delete**: Soft confirmation dialog and entry removal.

---

## 📁 Project Structure

```
student feedback management system/
├── api/
│   └── index.py            # Flask REST API backend & database models (Vercel serverless function entrypoint)
├── public/
│   ├── index.html          # Public Student Feedback submission page
│   ├── admin.html          # Admin Dashboard & Login modal page
│   ├── css/
│   │   └── styles.css      # Custom responsive styling system (Vanilla CSS, CSS Grid/Flexbox)
│   └── js/
│       ├── app.js          # Public form logic & star rating interaction
│       └── admin.js        # Admin dashboard logic, JWT auth & filtering
├── .env.example            # Sample environment variables file
├── .gitignore              # Ignored files for Git (venv, db, env, cache)
├── requirements.txt        # Python dependencies
├── run.py                  # Local development server runner
├── vercel.json             # Vercel deployment & routing configuration
└── README.md               # Project documentation
```

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom design system, CSS Grid/Flexbox, Glassmorphism, Animations), Vanilla JavaScript (ES6+, Fetch API).
- **Backend**: Python 3.x, Flask (RESTful API), Flask-SQLAlchemy (ORM), Flask-CORS, PyJWT, Python-dotenv.
- **Database**: SQLite (`feedback.db` locally, `/tmp/feedback.db` in serverless environment).
- **Deployment**: Vercel Serverless Functions (`@vercel/python` runtime).

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | API Health Check |
| `POST` | `/api/login` | Public | Admin login, returns JWT token |
| `POST` | `/api/feedback` | Public | Submit new student feedback |
| `GET` | `/api/feedback` | Admin | List all feedbacks (supports search `q`, `department`, `feedback_type`, `rating`, `status`, `sort_by`, `order`) |
| `GET` | `/api/feedback/<id>` | Admin | Retrieve single feedback details |
| `PUT` | `/api/feedback/<id>` | Admin | Update status (`"Reviewed"` or `"Pending"`) |
| `DELETE` | `/api/feedback/<id>` | Admin | Delete feedback entry |
| `GET` | `/api/stats` | Admin | Aggregated stats for dashboard cards & charts |

---

## 💻 Local Quick Start Guide

### Prerequisites
- Python 3.9+ installed
- Git

### 1. Clone & Navigate to Project Directory
```bash
git clone <repository-url>
cd "student feedback management system"
```

### 2. Set Up Python Virtual Environment
```bash
# Create virtual environment
python3 -m venv venv

# Activate on macOS / Linux:
source venv/bin/activate

# Activate on Windows:
# venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default credentials inside `.env`:
- **ADMIN_USERNAME**: `admin`
- **ADMIN_PASSWORD**: `admin123`
- **SECRET_KEY**: `super-secret-key-change-this-in-production-12345`

### 5. Run the Local Server
```bash
python run.py
```

Open your browser and visit:
- **Public Feedback Portal**: [http://127.0.0.1:5000/](http://127.0.0.1:5000/)
- **Admin Dashboard**: [http://127.0.0.1:5000/admin.html](http://127.0.0.1:5000/admin.html)

---

## 🚀 Deployment Guide: Deploying to Vercel via GitHub

### Step 1: Push Code to GitHub
1. Initialize Git repository and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Student Feedback Management System"
   ```
2. Create a new repository on [GitHub](https://github.com/new).
3. Connect your local repository and push:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Import Project in Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **"Add New..."** -> **"Project"**.
3. Import your newly created GitHub repository.
4. Framework Preset: Leave as **Other** (or automatic).
5. Build and Output Settings: Leave as default (`vercel.json` automatically manages routes).

### Step 3: Configure Environment Variables in Vercel
Under the **Environment Variables** section during deployment (or in Project Settings -> Environment Variables):
Add the following keys:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `SECRET_KEY` | `your-production-jwt-secret-key-xyz` | High entropy random string |
| `ADMIN_USERNAME` | `admin` | Your desired admin username |
| `ADMIN_PASSWORD` | `SecureAdminPass2026!` | Your desired admin password |

### Step 4: Deploy!
Click **"Deploy"**. Vercel will build the Python serverless function and deploy the static frontend assets.
Once deployed, Vercel will provide a live public URL (e.g. `https://your-project.vercel.app`).

---

## 🛡️ License & Credits
Built as an educational full-stack web application project.
