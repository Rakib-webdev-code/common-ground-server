# Common Ground — Backend API

**Small actions. Stronger communities.**

The Common Ground backend powers a community event platform where users can discover events, organize activities, manage registrations, and track community participation.

🌐 **Live Frontend:** https://common-ground-client.vercel.app

🖥️ **Live Backend API:** https://common-ground-server.vercel.app

## ✨ Features

- **Event Management:** Create, view, update, and delete community events.
- **Upcoming Events:** Retrieve all upcoming events, sorted by event date.
- **Recent Events:** Retrieve the six most recent upcoming events.
- **Event Registration:** Allow authenticated users to join upcoming events.
- **Duplicate Prevention:** Prevent users from registering for the same event more than once.
- **Joined Events:** Retrieve events joined by the authenticated user.
- **My Events:** Retrieve events created by the authenticated user.
- **Ownership Authorization:** Restrict event updates and deletion to their creators.
- **Community Dashboard:** Provide event and participant statistics.
- **JWT Authentication:** Verify Better Auth tokens using remote JWKS.
- **MongoDB Integration:** Store event and registration data in MongoDB.

## 🛠️ Technologies Used

- Node.js
- Express.js 5
- MongoDB
- MongoDB Node.js Driver
- Better Auth JWT
- JOSE
- CORS
- dotenv

## 📁 Project Structure

```text
common-ground-server/
├── middlewares/
│   └── verify-token.js
├── index.js
├── package.json
├── package-lock.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- MongoDB database
- Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Rakib-webdev-code/common-ground-server.git
   ```

2. Navigate to the project directory:

   ```bash
   cd common-ground-server
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root:

   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DATABASE=your_database_name
   AUTH_BASE_URL=http://localhost:3000
   ```

   Replace the example values with your own configuration.

   **Important:** `AUTH_BASE_URL` must point to the Better Auth application that issues the JWTs. For local development, use the local frontend URL. For production, configure the deployed frontend URL.

5. Start the server:

   ```bash
   node index.js
   ```

6. Open the following URL:

   [http://localhost:5000](http://localhost:5000)

## 🔌 API Endpoints

### General

| Method | Endpoint | Access |
|---|---|---|
| GET | `/` | Public |

### Events

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/events` | Public | Get upcoming events |
| GET | `/api/events/recent` | Public | Get six recent upcoming events |
| GET | `/api/events/:id` | Public | Get event details |
| POST | `/api/events` | Protected | Create an event |
| PATCH | `/api/events/:id` | Protected | Update an owned event |
| DELETE | `/api/events/:id` | Protected | Delete an owned event |
| GET | `/api/events/my-events` | Protected | Get events created by the current user |
| POST | `/api/events/:id/join` | Protected | Join an event |
| GET | `/api/events/joined` | Protected | Get joined events |

### Dashboard

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats` | Protected | Get community and personal statistics |

### Authentication Check

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/auth-check` | Protected | Verify authenticated user information |

## 🔐 Authentication & Security

The backend uses Better Auth JWT authentication.

- Protected routes require a Bearer token in the Authorization header.
- JWT signatures are verified using the Better Auth remote JWKS endpoint.
- The middleware validates the token issuer, audience, and EdDSA algorithm.
- Invalid, missing, or expired tokens receive an HTTP 401 response.
- Event ownership is checked before update and deletion operations.
- Duplicate event registrations are prevented using a unique compound MongoDB index on `userId` and `eventId`.

### Authorization Header

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## 🗄️ Database Collections

The backend uses MongoDB collections for:

- `events` — Stores community event information.
- `joinedEvents` — Stores event registration records.

A unique compound index prevents duplicate registrations by the same user for the same event.

## 🌍 Deployment

The backend is deployed on Vercel.

- **Frontend:** https://common-ground-client.vercel.app
- **Backend:** https://common-ground-server.vercel.app

### Production Environment Variables

Configure the following variables in the deployment environment:

- `PORT`
- `MONGODB_URI`
- `MONGODB_DATABASE`
- `AUTH_BASE_URL`

Never expose database credentials, authentication secrets, or other private configuration values in source code or GitHub.

## 👨‍💻 Developer

**Md. Rakib**

- GitHub: [Rakib-webdev-code](https://github.com/Rakib-webdev-code)
- Frontend Repository: [Common Ground Client](https://github.com/Rakib-webdev-code/common-ground-client)
- Portfolio: [About Me](https://rakib-webdev-code.github.io/About-Me/)

---

Built with ❤️ to encourage community participation and meaningful connections.