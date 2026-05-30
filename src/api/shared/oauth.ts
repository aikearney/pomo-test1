import passport from "passport";

// Use require with any typing for modules without type definitions
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;

export interface OAuthUser {
  id: string;
  displayName: string;
  email?: string;
  provider: string;
}

passport.serializeUser((user: any, done: (err: any, id?: any) => void) => {
  done(null, user);
});

passport.deserializeUser((user: any, done: (err: any, user?: any) => void) => {
  done(null, user);
});

// Google OAuth Strategy
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || "/.auth/callback/google";

if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
      },
      (_accessToken: string, _refreshToken: string, profile: any, done: (err: any, user?: any) => void) => {
        const user: OAuthUser = {
          id: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value,
          provider: "google",
        };
        done(null, user);
      }
    )
  );
}

// Facebook OAuth Strategy
const facebookAppId = process.env.FACEBOOK_APP_ID;
const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
const facebookCallbackUrl = process.env.FACEBOOK_CALLBACK_URL || "/.auth/callback/facebook";

if (facebookAppId && facebookAppSecret) {
  passport.use(
    new FacebookStrategy(
      {
        appID: facebookAppId,
        appSecret: facebookAppSecret,
        callbackURL: facebookCallbackUrl,
        profileFields: ["id", "displayName", "photos", "email"],
      },
      (_accessToken: string, _refreshToken: string, profile: any, done: (err: any, user?: any) => void) => {
        const user: OAuthUser = {
          id: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value,
          provider: "facebook",
        };
        done(null, user);
      }
    )
  );
}

export function isOAuthProviderConfigured(provider: string): boolean {
  switch (provider.toLowerCase()) {
    case "google":
      return !!(googleClientId && googleClientSecret);
    case "facebook":
      return !!(facebookAppId && facebookAppSecret);
    default:
      return false;
  }
}

export function getConfiguredProviders(): string[] {
  const providers: string[] = [];
  if (googleClientId && googleClientSecret) providers.push("google");
  if (facebookAppId && facebookAppSecret) providers.push("facebook");
  return providers;
}

