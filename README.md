# Logistics Management System - MVP

Full-stack logistics and delivery management system developed collaboratively by a team of 6 students as a Software Engineering course project. This repository reflects a stable Sprint 1 release featuring a core end-to-end workflow.

## 🚀 Tech Stack
* **Backend & Web Frontend:** Python, Django, Django REST Framework, Django Templates (HTML, CSS, JavaScript), SQLite
* **Mobile App:** React Native, Expo
* **Architecture:** RESTful API

## 👨‍💻 My Technical Contributions (Sprint 1)

* **Authentication & Security:** Engineered a secure session-based login system for the web interface using encrypted cookies, automatic timeout policies (1-hour inactivity), and password/PIN hashing. Implemented custom decorators for Role-Based Access Control (RBAC) and mitigated user enumeration vulnerabilities during login.
* **RESTful API Development:** Built core endpoints using Django REST Framework for the React Native mobile app, including mobile authentication, fetching daily delivery itineraries, and managing active deliveries (e.g., modifying and deleting current tasks).
* **Database Architecture:** Designed and implemented relational models for core business entities: Personnel (Administrators and Drivers), Route Sheets, and Deliveries.
* **Web Views & Business Logic:** Developed full CRUD operations for the Route Sheets module using Django native templates. Implemented specific business rules, such as filtering out inactive drivers from assignment pools and optimizing unpaginated ID search queries.
* **Testing & Integration:** Executed end-to-end integration tests for web/mobile authentication and route management workflows. Managed the final sprint integration process, ensuring the MVP complied with the client's user stories.

---

## ⚙️ Local Setup Instructions

### Backend & Web Interface (Django)
1. Navigate to the backend directory: `cd BACK-WEB`
2. Create and activate a virtual environment: 
   * Windows: `python -m venv venv` and `venv\Scripts\activate`
   * Linux/macOS: `python3 -m venv venv` and `source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Configure environment variables: 
   * Navigate to `cd logistica_envios`
   * Copy the example file: `copy .env.example .env` (or `cp` on Linux/macOS)
   * Generate a random secret key and assign it to `SECRET_KEY` in your `.env` file.
5. Apply database migrations: `python manage.py migrate`
6. Run the development server: `python manage.py runserver` 
*(The web interface and API endpoints will be available at `http://127.0.0.1:8000/`)*

### Mobile App (Expo React Native)
1. Navigate to the frontend directory: `cd APP`
2. Install node dependencies: `npm install`
3. Start the Metro Bundler: `npx expo start`
4. Run the application:
   * **Mobile:** Scan the QR code with the Expo Go app on your phone (ensure both devices share the same Wi-Fi network).
   * **Emulator:** Press `a` for Android or `i` for iOS.