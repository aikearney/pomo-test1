# OAuth Authentication Setup

## Overview

The application now supports OAuth-based authentication through Google and Facebook. The backend implements full OAuth flow handling using Passport.js and integrates with Azure Easy Auth when available.

## Architecture

### Two Authentication Paths

1. **Azure Easy Auth (Recommended for Azure deployment)**
   - When deployed to Azure App Service with Easy Auth enabled
   - App Service handles OAuth automatically
   - Backend extracts user info from `x-ms-client-principal-*` headers
   - No additional configuration needed beyond env vars

2. **Fallback OAuth (Local dev, non-Azure deployments)**
   - Backend implements full OAuth flow via Passport.js
   - Handles login/logout/callback endpoints
   - Works on any Node.js server
   - Manages sessions and OAuth state

### Authentication Flow

```
Frontend                     Backend               OAuth Provider
   │                            │                        │
   ├─ Click Login ──────────────>│                        │
   │                     /.auth/login/{provider}          │
   │                            │                         │
   │                            ├─ Redirect to Provider ──>
   │  (Redirect)                │                         │
   │<─────────────────────────────────────────────────────┤
   │                                                       │
   │  (User authenticates with provider)                  │
   │                    ┌──────────────────────────────┐  │
   │                    │                              │  │
   │                    └──────────────────────────────┘  │
   │                                                       │
   │  ┌─ Redirect to callback ──────────────────────────────>
   │  │                            │
   │  │                     /.auth/callback/{provider}
   │  │                            │
   │  │                   (Validate & store auth)
   │  │                            │
   │  │  ┌─ Redirect to app ──────>│
   │  │  │                         │
   │  └──┴─ Session established ──┘
   │
   ├─ Fetch /.auth/me ─────────────>
   │                        (Returns user info)
   │<─ User authenticated ──────────┤
```

## Environment Variables

### Required for Google OAuth

```
GOOGLE_CLIENT_ID        # OAuth 2.0 Client ID from Google Cloud Console
GOOGLE_CLIENT_SECRET    # OAuth 2.0 Client Secret from Google Cloud Console
```

### Required for Facebook OAuth

```
FACEBOOK_APP_ID         # Facebook App ID
FACEBOOK_APP_SECRET     # Facebook App Secret
```

### Optional

```
GOOGLE_CALLBACK_URL     # Override callback URL (default: /.auth/callback/google)
FACEBOOK_CALLBACK_URL   # Override callback URL (default: /.auth/callback/facebook)
SESSION_SECRET          # Express session secret key (default: "dev-secret-change-in-production")
                        # CHANGE THIS IN PRODUCTION!
NODE_ENV                # Set to "production" for secure cookies
```

## API Endpoints

### Authentication Endpoints

#### `GET /.auth/me`
Returns current authentication status and user information.

**Response (authenticated):**
```json
[{
  "user_id": "google_12345",
  "user_claims": [
    {"typ": "name", "val": "John Doe"},
    {"typ": "preferred_username", "val": "john@example.com"}
  ]
}]
```

**Response (not authenticated):**
```json
{"statusCode": 401}
```

#### `GET /.auth/login/:provider?post_login_redirect_uri={uri}`
Initiates OAuth login flow with the specified provider.

**Parameters:**
- `provider` - "google" or "facebook"
- `post_login_redirect_uri` - URL to redirect to after successful login

#### `GET /.auth/callback/:provider`
OAuth provider callback endpoint. This is handled automatically by Passport.

#### `GET /.auth/logout?post_logout_redirect_uri={uri}`
Logs out the user and clears the session.

**Parameters:**
- `post_logout_redirect_uri` - URL to redirect to after logout (default: "/")

## Frontend Integration

The frontend already has the proper login/logout flow:

```typescript
// Login
const redirectToLogin = (provider: string) => {
  const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.assign(`/.auth/login/${provider}?post_login_redirect_uri=${redirect}`);
};

// Check auth status
const res = await fetch('/.auth/me', { credentials: 'include' });
const authInfo = await res.json();

// Logout
const redirectToLogout = () => {
  const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.assign(`/.auth/logout?post_logout_redirect_uri=${redirect}`);
};
```

## Setup Instructions

### Local Development

1. **Create OAuth Apps**
   
   - **Google:**
     - Go to [Google Cloud Console](https://console.cloud.google.com/)
     - Create a new project
     - Enable Google+ API
     - Create OAuth 2.0 credentials (Web application type)
     - Set authorized redirect URIs:
       - `http://localhost:7071/.auth/callback/google` (local)
       - `https://yourdomain.com/.auth/callback/google` (production)
     - Copy Client ID and Secret

   - **Facebook:**
     - Go to [Facebook Developers](https://developers.facebook.com/)
     - Create a new app (type: Consumer)
     - Add Facebook Login product
     - Configure OAuth redirect URIs:
       - `http://localhost:7071/.auth/callback/facebook` (local)
       - `https://yourdomain.com/.auth/callback/facebook` (production)
     - Copy App ID and App Secret

2. **Set Local Environment Variables**
   
   Create a `.env` file in the project root or set in your shell:
   ```bash
   export GOOGLE_CLIENT_ID=your_client_id
   export GOOGLE_CLIENT_SECRET=your_client_secret
   export FACEBOOK_APP_ID=your_app_id
   export FACEBOOK_APP_SECRET=your_app_secret
   export SESSION_SECRET=your-dev-secret-key
   ```

3. **Start Development Server**
   ```bash
   npm install
   npm run build
   npm --prefix src/api start
   ```

### Azure App Service Deployment

#### Option A: Using Azure Easy Auth (Recommended)

1. **Deploy the app to Azure App Service**
   ```bash
   az webapp up --resource-group myResourceGroup --name myAppName
   ```

2. **Configure Easy Auth in Azure Portal**
   - Navigate to your App Service
   - Settings → Authentication → Add Identity Provider
   - Configure Google OAuth:
     - Select "Google"
     - Client ID: (from Google Cloud Console)
     - Client secret: (from Google Cloud Console)
     - Allowed token audiences: (leave empty or add your app URL)
     - Restrict access to: Allow unauthenticated access
   - Repeat for Facebook

3. **Set Redirect URIs in OAuth Apps**
   - Google Cloud Console:
     - Add: `https://yourappname.azurewebsites.net/.auth/login/google/callback`
   - Facebook Developers:
     - Add: `https://yourappname.azurewebsites.net/.auth/login/facebook/callback`

4. **Environment Variables** (optional for Easy Auth, but may be needed as fallback)
   - App Service → Configuration → Application settings
   - Add the OAuth credentials

#### Option B: Using Backend OAuth (If Easy Auth not available)

1. **Set Environment Variables in Azure Portal**
   - App Service → Configuration → Application settings
   - Add: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - Add: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
   - Add: `SESSION_SECRET` (strong random value)
   - Add: `NODE_ENV=production`

2. **Configure OAuth App Redirect URIs**
   - Google: `https://yourappname.azurewebsites.net/.auth/callback/google`
   - Facebook: `https://yourappname.azurewebsites.net/.auth/callback/facebook`

3. **Deploy**
   ```bash
   git push
   # GitHub workflow deploys automatically
   ```

## Troubleshooting

### Login redirects back without authenticating

**Possible Causes:**
1. OAuth credentials not configured (env vars not set)
2. OAuth app redirect URIs don't match the app URL
3. Easy Auth enabled but not properly configured

**Solution:**
- Check that all required env vars are set:
  ```bash
  npm --prefix src/api start 2>&1 | grep -i oauth
  ```
- Verify redirect URIs match your deployment URL
- Check Azure App Service logs in Portal → Monitoring → Log stream

### "Provider not configured" error

**Cause:** OAuth credentials for the chosen provider are not set

**Solution:**
- Set the required environment variables
- Restart the application

### Session/Cookies not persisting

**Possible Causes:**
1. Cookies not marked as secure in development
2. SameSite cookie policy too strict
3. Session secret changed between restarts

**Solution:**
- Set `SESSION_SECRET` env var consistently
- In development: `NODE_ENV` should NOT be "production"
- Check browser console for cookie warnings

### Azure Easy Auth returning 401

**Possible Causes:**
1. Easy Auth not enabled on App Service
2. Authentication provider not configured in Easy Auth settings
3. Authorization claims not correct

**Solution:**
- App Service → Authentication → Status should be "On"
- Verify identity provider is added
- Check Portal → App Service → Logs → Authentication logs

## Security Considerations

1. **Session Secret**
   - Change `SESSION_SECRET` in production
   - Use a strong random value (32+ characters)
   - Store securely in Azure Key Vault

2. **HTTPS Only**
   - Cookies are HTTPS-only in production (`NODE_ENV=production`)
   - Ensure your App Service has HTTPS redirects enabled

3. **CORS**
   - The app uses `credentials: include` in fetch requests
   - Make sure your OAuth app allows this domain

4. **Token Expiration**
   - Sessions expire after 24 hours
   - Users must re-authenticate after expiration

## Testing OAuth Flow

### Local Testing

```bash
# Terminal 1: Start the backend
npm --prefix src/api start

# Terminal 2: Start the frontend (in another shell)
npm run dev
```

Then:
1. Navigate to `http://localhost:5173`
2. Click the login button
3. Select a provider (Google or Facebook)
4. Complete OAuth authorization
5. Should redirect back to the app as authenticated user

### Verify Authentication Headers

```bash
# Check if /.auth/me returns user info
curl http://localhost:7071/.auth/me \
  -H "Cookie: (your session cookie)" \
  -v
```

## Migration from Azure Static Web Apps

If migrating from Static Web Apps (SWA):

**Old SWA behavior:**
- SWA handled all `/.auth/*` endpoints
- Tokens stored in SWA-managed cookies
- No OAuth configuration needed in code

**New behavior:**
- Backend implements `/.auth/*` endpoints
- Session cookies managed by Express.js
- OAuth must be configured via environment variables
- Same frontend login/logout flow (no changes needed)

**Migration Steps:**
1. Set OAuth environment variables
2. Deploy the updated backend
3. Test OAuth flow
4. No frontend changes required

## Additional Resources

- [Passport.js Documentation](http://www.passportjs.org/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login)
- [Azure App Service Authentication](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization)
- [Express Sessions](https://github.com/expressjs/session)
