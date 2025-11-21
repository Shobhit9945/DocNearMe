# DocNearMe - Healthcare Provider Finder

A modern web application built with React, Next.js, and Prisma to help users find healthcare professionals in their area.

## Features

- 🏛️ Government-style professional design
- 🎨 Smooth animations and transitions
- 🔐 Multiple authentication methods (email/password + Google OAuth)
- 📱 Fully responsive design with Tailwind CSS
- 🗄️ Database integration with Prisma
- 🔒 Secure authentication with NextAuth.js
- 🎫 Session-based authentication
- 🛡️ HIPAA-compliant security messaging
- ✨ Modern UI with hover effects and micro-interactions

## Tech Stack

- **Frontend**: React, Next.js, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT tokens with bcrypt password hashing

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory with:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-nextauth-secret-key"
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

   **To set up Google OAuth:**
   1. Go to [Google Cloud Console](https://console.cloud.google.com/)
   2. Create a new project or select existing one
   3. Enable Google+ API
   4. Go to "Credentials" and create OAuth 2.0 Client ID
   5. Add `http://localhost:3000/api/auth/callback/google` to authorized redirect URIs
   6. Copy the Client ID and Client Secret to your `.env.local` file

3. **Set up the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
doc-near-me/
├── src/
│   ├── app/
│   │   ├── api/auth/          # Authentication API routes
│   │   ├── auth/              # Login/signup page
│   │   ├── dashboard/         # User dashboard
│   │   ├── globals.css        # Global styles
│   │   ├── layout.js          # Root layout
│   │   └── page.js            # Landing page
│   └── lib/
│       └── prisma.js          # Prisma client configuration
├── prisma/
│   └── schema.prisma          # Database schema
└── public/                    # Static assets
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

## Database Schema

The application uses a simple User model with the following fields:
- `id` - Unique identifier
- `email` - User email (unique)
- `name` - User's full name
- `password` - Hashed password
- `createdAt` - Account creation timestamp
- `updatedAt` - Last update timestamp

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema changes to database
- `npx prisma migrate dev` - Create and apply migrations

### Database Management

To view your database in Prisma Studio:
```bash
npx prisma studio
```

## Security Notes

- Passwords are hashed using bcrypt with a salt rounds of 12
- JWT tokens are used for authentication
- Remember to change the JWT_SECRET in production
- Consider implementing rate limiting for production use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.