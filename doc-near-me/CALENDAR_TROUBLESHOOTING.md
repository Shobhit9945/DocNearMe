# Google Calendar Integration Troubleshooting

## Current Issues
1. Hydration error in auth page ✅ (Fixed)
2. Calendar not syncing after Google sign-in ⚠️ (Needs fixing)

## Steps to Fix Calendar Sync

### 1. Enable Google Calendar API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" → "Library"
4. Search for "Google Calendar API"
5. Click on "Google Calendar API" and click "ENABLE"

### 2. Verify OAuth Scopes
The app requests these scopes:
- `openid` - Basic user info
- `profile` - User profile
- `email` - User email  
- `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events

### 3. Check OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Make sure these scopes are listed in "Scopes for Google APIs":
   - `../auth/calendar.readonly`
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `openid`

### 4. Test Steps
1. Clear browser cookies/storage for localhost:3000
2. Sign out of the app completely
3. Sign back in with Google
4. During OAuth consent, verify you see permission for "See, edit, share, and permanently delete all calendars you can access using Google Calendar"
5. Go to dashboard and check if calendar loads

### 5. Debug Information
Check these URLs while signed in:
- http://localhost:3000/api/auth/debug - Shows session info
- http://localhost:3000/api/calendar/events - Shows calendar API response
- http://localhost:3000/api/auth/config - Shows OAuth configuration

### 6. Common Issues
- **Calendar API not enabled**: Enable in Google Cloud Console
- **Missing refresh token**: Need `access_type: 'offline'` and `prompt: 'consent'`
- **Wrong scopes**: Must include calendar.readonly scope
- **Test user not added**: Add your email to OAuth consent screen test users

## Expected Flow
1. Google sign-in → OAuth consent screen appears
2. User grants calendar permission
3. App receives access + refresh tokens  
4. Dashboard loads calendar events automatically
5. "Connect Google" buttons should disappear (already connected)

## If Still Not Working
1. Check browser developer console for errors
2. Check terminal/server logs for API errors
3. Verify Google Calendar API quotas aren't exceeded
4. Try with a different Google account as test user