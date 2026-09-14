# FitFam Gym Management System

FitFam is a student-friendly gym administration system built with Angular, Node.js, Express, and MySQL. It demonstrates authentication, role-based access, REST APIs, CRUD operations, and relational database design in a practical fitness-management workflow.

## Objectives

- Manage members, trainers, membership plans, workouts, and attendance.
- Protect API resources with JWT authentication and role authorization.
- Connect an Angular frontend to a real Express and MySQL backend.
- Demonstrate one-to-one and one-to-many database relationships.

## Features

- Public landing page, registration, and login.
- Admin, trainer, and member roles.
- Dashboard statistics.
- Separate admin, trainer, and member workspaces with role-protected routes.
- Member, trainer, membership, workout, and attendance API resources.
- Automatic `FitFam Free` membership for every new member.
- Standard and Premium plans are displayed as paid upgrades coming soon.
- Member search, profile editing, loading, empty, success, and error states.
- Password hashing with bcryptjs and parameterized MySQL queries.
- Responsive Angular workspace layout.

## Technology Stack

- Frontend: Angular 17, TypeScript, Angular Router, Reactive Forms, HttpClient
- Backend: Node.js, Express, JWT, bcryptjs, mysql2, CORS
- Database: MySQL 8+

## Architecture

```text
Angular Frontend (localhost:4200)
          |
          | JSON REST API
          v
Express API (localhost:5000)
          |
          v
MySQL database: fitfam_gym
```

## Folder Structure

```text
frontend/       Angular application
backend/        Express REST API
database/       schema.sql and seed.sql
README.md       Setup and API guide
```

## Requirements

Install these before starting:

- Node.js 18 or newer and npm
- MySQL Server 8 or newer
- A browser and optionally Postman or Thunder Client

## MySQL Setup

1. Install MySQL Server from the official MySQL installer or your operating system package manager. Remember the MySQL username and password created during installation.
2. Open MySQL Workbench or a MySQL terminal.
3. Run the schema file. From the project root, the command is:

```bash
mysql -u root -p < database/schema.sql
```

4. Load the sample records:

```bash
mysql -u root -p < database/seed.sql
```

The schema creates the `fitfam_gym` database and these tables: `users`, `members`, `trainers`, `membership_catalog`, `membership_plans`, `workouts`, and `attendance`.

## Backend Setup

```bash
cd backend
copy .env.example .env
npm install
```

Edit `backend/.env` with your local MySQL details:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=fitfam_gym
JWT_SECRET=replace-with-a-long-random-development-secret
JWT_EXPIRES_IN=1d
PORT=5000
CORS_ORIGIN=http://localhost:4200
```

Start the API:

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

Check that it is running by opening [http://localhost:5000/api/health](http://localhost:5000/api/health). It should return JSON showing that the API is running.

## Frontend Setup

In a second terminal:

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200). The API URL is configured in `frontend/src/environments/environment.ts` and defaults to `http://localhost:5000/api`.

## Sample Accounts

All seeded accounts use the password `Password123!`:

| Role | Email |
| --- | --- |
| Admin | admin@fitfam.ng |
| Trainer | trainer@fitfam.ng |
| Member | member@fitfam.ng |

Do not use these credentials outside local demonstration work.

## Memberships

New public registrations always receive an active `FitFam Free` membership. It costs `N0` and has no payment requirement. It includes basic workout access, fitness tracking, attendance tracking, the member profile, and basic gym resources.

`Standard Monthly` (N18,000) and `Premium Monthly` (N30,000) remain available to administrators as plan/catalog options and are shown to members as **Coming Soon** upgrades. No fake payment or subscription API is used.

## Role Dashboards

- **Admin:** sees MySQL-derived total members, active members, trainers, today's attendance, and active memberships, plus all management navigation.
- **Trainer:** sees assigned workouts, managed members, today's assigned-member attendance, and recent attendance. Trainers can manage workouts and record attendance but cannot manage plans or trainers.
- **Member:** sees their own profile, current membership, assigned workouts, attendance count, and recent attendance. Member ownership is enforced by the backend, not only by Angular routing.

Dashboard counts are calculated by `GET /api/dashboard/stats` directly from MySQL, so member, attendance, workout, and membership changes are reflected automatically after a refresh.

## API Endpoints

All protected routes require this header:

```text
Authorization: Bearer <jwt-token>
```

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register a member |
| POST | `/api/auth/login` | Log in and receive a JWT |
| GET | `/api/auth/me` | Get the logged-in user |
| GET/POST | `/api/members` | List or create members |
| GET/PUT/DELETE | `/api/members/:id` | Read, update, or deactivate a member |
| GET/POST | `/api/trainers` | List or create trainers |
| GET/PUT/DELETE | `/api/trainers/:id` | Read, update, or deactivate a trainer |
| GET/POST | `/api/memberships` | List or create memberships |
| GET/PUT/DELETE | `/api/memberships/:id` | Read, update, or delete a membership |
| GET/POST | `/api/workouts` | List or create workout plans |
| GET/PUT/DELETE | `/api/workouts/:id` | Read, update, or delete a workout |
| GET/POST | `/api/attendance` | List or record attendance |
| GET/PUT/DELETE | `/api/attendance/:id` | Read, update, or delete attendance |
| GET | `/api/dashboard/stats` | Get dashboard counts |

## Example Request Bodies

Register:

```json
{
  "firstName": "Ada",
  "lastName": "Okoro",
  "email": "ada@example.com",
  "password": "Password123!",
  "phone": "08031234567",
  "gender": "Female",
  "dateOfBirth": "1999-04-12"
}
```

Login:

```json
{
  "email": "admin@fitfam.ng",
  "password": "Password123!"
}
```

Add member (admin):

```json
{
  "firstName": "Bola",
  "lastName": "James",
  "email": "bola@example.com",
  "password": "Password123!",
  "phone": "08039876543"
}
```

Add trainer (admin):

```json
{
  "firstName": "Ibrahim",
  "lastName": "Yusuf",
  "email": "ibrahim@example.com",
  "password": "Password123!",
  "specialization": "Personal training"
}
```

Add workout (admin or trainer):

```json
{
  "memberId": 1,
  "trainerId": 1,
  "title": "Leg Day",
  "description": "Squats, lunges, and controlled strength work.",
  "frequency": "2 days per week"
}
```

Add attendance (admin or trainer):

```json
{
  "memberId": 1,
  "attendanceDate": "2026-08-27",
  "checkIn": "07:30:00",
  "status": "present"
}
```

## Role Rules

- Admin: full management access.
- Trainer: view members and trainers, manage workouts, and record attendance.
- Member: view their own member, membership, workout, and attendance information.

## Validation and Security

The backend validates required fields, password length, duplicate emails, resource IDs, roles, and database operations. Passwords are stored as bcrypt hashes. JWT-protected routes, CORS, environment variables, parameterized SQL, and sanitized user responses are included. Database credentials and JWT secrets are never returned by the API.

## Testing

- Open `GET /api/health` in a browser.
- Use Postman or Thunder Client for protected CRUD requests.
- First call login, copy the returned token, and add it as a Bearer token to subsequent requests.
- Run backend syntax checks:

```bash
cd backend
npm run check
```

- Build the Angular application:

```bash
cd frontend
npm run build
```

## Troubleshooting

- `ECONNREFUSED` from the API usually means MySQL is not running or the `.env` credentials are incorrect.
- A CORS error means the frontend URL in `CORS_ORIGIN` does not match the browser URL.
- If seed imports fail because records already exist, rerun `database/schema.sql` first. The schema intentionally drops and recreates its tables for local development.
- If `npm.ps1` is blocked by Windows execution policy, use `npm.cmd install`, `npm.cmd start`, or run the same commands from `cmd.exe`.

## Future Improvements

- Add pagination and richer server-side filtering.
- Add a dedicated subscription history table and payment integration.
- Add automated Angular and API tests.
- Add email verification, refresh tokens, and audit logging for production use.
