# Google OAuth Setup Instructions

Your Google OAuth credentials are missing. Here's how to set them up:

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application" as the application type
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
   - Save and note down the Client ID and Client Secret

## Step 2: Add Credentials to Environment

Add these lines to your `.env.local` file:

```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

## Step 3: Restart Development Server

After adding the credentials:
```bash
npm run dev
```

The Google sign-in should now work!

## Required Scopes

The app automatically requests these Google Calendar scopes:
- `openid` - Basic user info
- `profile` - User profile info  
- `email` - User email
- `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events

## Troubleshooting

- Make sure redirect URIs in Google Console match exactly
- Ensure both Client ID and Secret are added to .env.local
- Restart the dev server after adding credentials
- Check browser console for detailed error messages