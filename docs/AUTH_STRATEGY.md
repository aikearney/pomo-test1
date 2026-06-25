# Auth Strategy: Bearer Token + Easy Auth Dual-Mode

**Document Status:** Implementation Guide  
**For:** Parker (Backend Engineer)  
**From:** Ripley (Lead Architect)  
**Date:** 2026-06-25  
**Priority:** Phase 2 of Production-Readiness Refactor  

---

## Overview

The authentication system needs to support **two modes** to serve both internal (web app) and external (Copilot, Alexa, plugins) clients:

1. **Bearer Token (JWT)** — New, preferred for external integrations
2. **Azure Easy Auth** — Existing, kept for backward compatibility

**Implementation approach:** Update `src/api/shared/auth.ts` to support both modes with Bearer taking precedence.

---

## Current State

**File:** `src/api/shared/auth.ts`

**Current function:**
```typescript
export function getUserId(req: any): string | undefined {
  // Extracts userId from x-ms-client-principal header only
  // ...
}
```

**Usage in endpoints:**
```typescript
const userId = await getAuthenticatedUserId(req);
if (!userId) {
  res.status(401).json({ error: "UNAUTHORIZED" });
  return;
}
```

---

## Bearer Token Mode (New)

### 1. JWT Token Structure

**Expected claims:**
```json
{
  "sub": "user-uuid-or-email",
  "aud": "pomodoro-app",
  "exp": 1719408000,
  "iat": 1719321600,
  "email": "user@example.com",
  "iss": "https://issuer.example.com"
}
```

### 2. Environment Variables (New)

Add these to `.env` or Azure Key Vault:

```bash
# JWT validation
JWT_SIGNING_KEY=<your-signing-key-or-issuer-url>     # For RS256 (public key) or HS256 (shared secret)
JWT_AUDIENCE=pomodoro-app                              # Expected 'aud' claim value
JWT_ISSUER=https://issuer.example.com                  # Expected 'iss' claim (optional)
JWT_ALGORITHMS=RS256,HS256                             # Allowed algorithms (default: RS256)

# Easy Auth (existing, unchanged)
# x-ms-client-principal headers are always available in Azure App Service
```

### 3. Implementation Checklist

#### Step 1: Install JWT Library

```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

#### Step 2: Update `src/api/shared/auth.ts`

Add new helper functions:

```typescript
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Extract and validate JWT Bearer token from Authorization header
 * @returns userId from token claims, or undefined if invalid/missing
 */
function getUserIdFromBearerToken(req: any): string | undefined {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Validate token signature and claims
    const secret = process.env.JWT_SIGNING_KEY;
    const audience = process.env.JWT_AUDIENCE;
    const algorithms = (process.env.JWT_ALGORITHMS || 'RS256').split(',');

    if (!secret) {
      console.error('JWT_SIGNING_KEY not configured');
      return undefined;
    }

    const decoded = jwt.verify(token, secret, {
      audience,
      algorithms: algorithms as any,
    }) as JwtPayload;

    // Extract userId from standard claims
    const userId = decoded.sub || decoded.oid || decoded.email;
    
    if (typeof userId === 'string' && userId.length > 0) {
      return userId;
    }

    return undefined;
  } catch (error) {
    // Token validation failed (invalid signature, expired, etc.)
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('JWT token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('JWT validation error:', error.message);
    }
    return undefined;
  }
}

/**
 * Get authenticated user ID using dual-mode auth:
 * 1. Bearer token (JWT) — preferred
 * 2. Azure Easy Auth — fallback
 * 
 * IMPORTANT: If Bearer token is present but invalid, return undefined.
 * Do NOT fall back to Easy Auth (prevents auth bypass).
 */
export async function getAuthenticatedUserId(req: any): Promise<string | undefined> {
  const authHeader = req.headers.authorization || '';
  const hasBearerToken = authHeader.startsWith('Bearer ');

  // Try Bearer token first
  if (hasBearerToken) {
    const userId = getUserIdFromBearerToken(req);
    // If Bearer token was provided, use its result (success or fail)
    // Do NOT fall back to Easy Auth on Bearer token failure
    return userId;
  }

  // Fall back to Easy Auth (existing implementation)
  return getUserId(req);
}
```

#### Step 3: Update Error Handling

Current error for invalid token:
```typescript
res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
```

Should remain the same — clients cannot distinguish between "no token" and "invalid token" at the HTTP level. Logging will capture the difference.

#### Step 4: Add Logging

For debugging, log authentication attempts:

```typescript
// In getAuthenticatedUserId:
if (hasBearerToken) {
  const userId = getUserIdFromBearerToken(req);
  if (userId) {
    console.info(`[AUTH] Bearer token validated for userId: ${userId}`);
  } else {
    console.warn(`[AUTH] Bearer token validation failed`);
  }
  return userId;
}

console.debug(`[AUTH] Trying Easy Auth fallback...`);
const userId = getUserId(req);
if (userId) {
  console.info(`[AUTH] Easy Auth validated for userId: ${userId}`);
}
return userId;
```

---

## Easy Auth Mode (Existing)

**No changes required.** Current implementation in `getUserId()` continues to work:

1. Extract `x-ms-client-principal` header
2. Parse base64-encoded JSON principal
3. Extract userId from claims

**Why it stays:** Web app in Azure App Service automatically injects these headers; no client-side code needed.

---

## Dual-Mode Logic Flow

```
REQUEST arrives at endpoint

if (Authorization: Bearer <token> is present) {
  ✓ Validate JWT signature, expiration, audience
  ✓ Extract userId from token
  if (valid) {
    PROCEED with authenticated userId
  } else {
    REJECT with 401 (do NOT try Easy Auth)
  }
} else if (x-ms-client-principal header is present) {
  ✓ Parse and validate Easy Auth header
  ✓ Extract userId from principal
  if (valid) {
    PROCEED with authenticated userId
  } else {
    REJECT with 401
  }
} else {
  REJECT with 401 (no auth found)
}
```

**Key point:** Bearer token, if present, is **authoritative**. We never fall back to Easy Auth if Bearer token is provided but invalid.

---

## Configuration Examples

### For Local Development (JWT HS256)

Use a shared secret for testing:

```bash
# .env (local)
JWT_SIGNING_KEY=dev-secret-key-12345
JWT_AUDIENCE=pomodoro-app
JWT_ALGORITHMS=HS256
```

Generate test token locally:
```bash
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: 'user-123', aud: 'pomodoro-app' },
  'dev-secret-key-12345'
);
console.log('Bearer ' + token);
"
```

Use in curl:
```bash
curl -H "Authorization: Bearer <token-from-above>" http://localhost:7071/api/ai/tasks
```

### For Azure Staging/Prod (JWT RS256)

Use Azure Key Vault to store the public key:

```bash
# Key Vault setup (one-time)
az keyvault secret set --vault-name my-keyvault --name jwt-public-key --file public-key.pem

# App settings
JWT_SIGNING_KEY=@Microsoft.KeyVault(SecretUri=https://my-keyvault.vault.azure.net/secrets/jwt-public-key/)
JWT_AUDIENCE=pomodoro-app-prod
JWT_ALGORITHMS=RS256
JWT_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
```

### For Local Easy Auth Testing

Local Azure Functions emulator doesn't support Easy Auth headers, so Bearer token is the only way to test locally.

For testing Easy Auth, deploy to Azure staging environment or use a mock header:

```bash
curl -H "x-ms-client-principal: eyJ..." http://localhost:7071/api/ai/tasks
```

---

## Testing Checklist

### Unit Tests (Jest)

```typescript
describe('getAuthenticatedUserId', () => {
  it('should extract userId from valid Bearer token', async () => {
    // Create token with sub claim
    // Pass in req with Authorization header
    // Expect userId to be extracted
  });

  it('should reject invalid Bearer token (expired)', async () => {
    // Create expired token
    // Pass in req with Authorization header
    // Expect undefined (do not fall back to Easy Auth)
  });

  it('should reject invalid Bearer token (wrong audience)', async () => {
    // Create token with wrong 'aud' claim
    // Expect undefined
  });

  it('should fall back to Easy Auth if no Bearer token', async () => {
    // Pass req with x-ms-client-principal header
    // No Authorization header
    // Expect Easy Auth to be used
  });

  it('should prefer Bearer token over Easy Auth', async () => {
    // Pass req with BOTH Authorization header and x-ms-client-principal
    // Expect Bearer token to be used (not Easy Auth)
  });
});
```

### Integration Tests (Supertest)

```typescript
it('POST /api/ai/tasks should succeed with Bearer token', async () => {
  const token = generateTestJWT({ sub: 'user-123' });
  const response = await request(app)
    .post('/api/ai/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(validPayload);
  expect(response.status).toBe(201);
});

it('POST /api/ai/tasks should fail with invalid Bearer token', async () => {
  const response = await request(app)
    .post('/api/ai/tasks')
    .set('Authorization', 'Bearer invalid-token')
    .send(validPayload);
  expect(response.status).toBe(401);
});
```

---

## Deployment

### 1. Update Environment Variables

In Azure Portal or via CLI:

```bash
az webapp config appsettings set \
  --resource-group my-rg \
  --name my-app \
  --settings JWT_SIGNING_KEY=@Microsoft.KeyVault(...) JWT_AUDIENCE=pomodoro-app
```

### 2. Deploy Code

```bash
git push origin working
# GitHub Actions workflow deploys to Azure
```

### 3. Test in Staging

```bash
# Generate token from your identity provider
TOKEN=$(./generate-jwt.sh)

# Test endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://pomo-staging.azurewebsites.net/api/ai/tasks \
  -X POST -d '...'
```

---

## Rollback Plan

If JWT implementation has issues:

1. All endpoints gracefully fall back to Easy Auth (if no Bearer token sent)
2. No existing functionality is broken
3. Simply disable Bearer token by removing `Authorization` header from clients

---

## Next Steps (After Phase 2)

- [ ] Add token refresh mechanism (exp claim handling)
- [ ] Implement request correlation ID for audit logging
- [ ] Add API key support (for server-to-server integrations)
- [ ] Rate limiting per user ID (from both Bearer and Easy Auth)

