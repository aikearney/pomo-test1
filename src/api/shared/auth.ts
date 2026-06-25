import jwt, { JwtPayload } from "jsonwebtoken";

function getHeader(req: any, name: string): string | undefined {
  const headers = req?.headers;
  if (!headers) {
    return undefined;
  }

  const direct = headers[name];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  if (Array.isArray(direct)) {
    const first = direct.find((value) => typeof value === "string" && value.length > 0);
    if (typeof first === "string") {
      return first;
    }
  }

  const match = Object.entries(headers).find(
    ([headerName, value]) => {
      if (headerName.toLowerCase() !== name.toLowerCase()) {
        return false;
      }

      if (typeof value === "string") {
        return value.length > 0;
      }

      return Array.isArray(value) && value.some((entry) => typeof entry === "string" && entry.length > 0);
    },
  );

  if (!match) {
    return undefined;
  }

  const value = match[1];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === "string" && entry.length > 0) as string | undefined;
  }

  return undefined;
}

function parseClientPrincipal(encodedPrincipal: string): any | undefined {
  const trimmed = encodedPrincipal.trim();

  // App Service/Easy Auth can pass either raw JSON or base64/base64url JSON.
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
  } catch {
    // Handle base64url payloads that may be emitted by some Easy Auth environments.
    try {
      const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    } catch {
      return undefined;
    }
  }
}

function getClaimValue(principal: any, claimTypes: string[]): string | undefined {
  const claims = principal?.claims;
  if (!Array.isArray(claims)) {
    return undefined;
  }

  const normalizedTypes = claimTypes.map((type) => type.toLowerCase());
  const claim = claims.find((entry: any) => {
    const claimType = (entry?.typ || entry?.type || "").toString().toLowerCase();
    return normalizedTypes.includes(claimType);
  });

  const value = claim?.val || claim?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getUserId(req: any): string | undefined {
  const principalId = getHeader(req, "x-ms-client-principal-id");
  if (principalId) {
    return principalId;
  }

  const encodedPrincipal = getHeader(req, "x-ms-client-principal");
  if (encodedPrincipal) {
    const decoded = parseClientPrincipal(encodedPrincipal);
    if (decoded) {
      const claimUserId =
        getClaimValue(decoded, [
          "sub",
          "oid",
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        ]) ||
        getClaimValue(decoded, [
          "http://schemas.microsoft.com/identity/claims/objectidentifier",
        ]);

      const decodedUserId = typeof decoded.userId === "string" && decoded.userId.length > 0
        ? decoded.userId
        : undefined;

      return decodedUserId || claimUserId;
    }
  }

  return undefined;
}

/**
 * Extract and validate JWT Bearer token from Authorization header.
 * Returns user context or undefined if token is invalid/missing.
 */
function verifyBearerToken(req: any): { userId: string; scopes: string[] } | undefined {
  try {
    const authHeader = getHeader(req, "authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return undefined;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Get JWT validation config from environment
    const secret = process.env.JWT_SIGNING_KEY;
    const audience = process.env.JWT_AUDIENCE;
    const issuer = process.env.JWT_ISSUER;
    const algorithms = (process.env.JWT_ALGORITHMS || "RS256").split(",");

    if (!secret) {
      console.warn("[AUTH] JWT_SIGNING_KEY not configured, skipping Bearer token validation");
      return undefined;
    }

    // Verify JWT signature, expiry, and claims
    const decoded = jwt.verify(token, secret, {
      audience: audience || undefined,
      issuer: issuer || undefined,
      algorithms: algorithms as jwt.Algorithm[],
    }) as JwtPayload;

    // Extract userId from standard claims (sub → oid → email)
    const userId = decoded.sub || decoded.oid || decoded.email;

    if (typeof userId !== "string" || userId.length === 0) {
      console.warn("[AUTH] JWT missing required userId claim (sub/oid/email)");
      return undefined;
    }

    // Extract scopes (often stored as space-separated string or array)
    let scopes: string[] = [];
    if (decoded.scope) {
      if (typeof decoded.scope === "string") {
        scopes = decoded.scope.split(" ").filter((s) => s.length > 0);
      } else if (Array.isArray(decoded.scope)) {
        scopes = decoded.scope.map((s) => String(s)).filter((s) => s.length > 0);
      }
    }

    console.log(`[AUTH] JWT Bearer token validated for userId=${userId}, scopes=${scopes.join(",")}`);

    return { userId, scopes };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn("[AUTH] JWT token expired:", error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn("[AUTH] JWT validation error:", error.message);
    } else {
      console.warn("[AUTH] Unexpected JWT error:", error);
    }
    return undefined;
  }
}

export interface AuthContext {
  userId: string;
  authMode: "jwt" | "easyauth";
  scopes: string[];
}

/**
 * Dual-mode auth: Try Bearer JWT first, fall back to Easy Auth.
 * Returns user context with auth mode and scopes.
 * Returns undefined if both methods fail (caller must reject with 401).
 */
export function getUserIdFromRequest(req: any): AuthContext | undefined {
  // Try Bearer token (JWT) first — preferred for external integrations
  const bearerContext = verifyBearerToken(req);
  if (bearerContext) {
    return {
      userId: bearerContext.userId,
      authMode: "jwt",
      scopes: bearerContext.scopes,
    };
  }

  // Fall back to Easy Auth (existing method for web app)
  const easyAuthUserId = getUserId({ headers: req.headers });
  if (easyAuthUserId) {
    console.log(`[AUTH] Easy Auth fallback for userId=${easyAuthUserId}`);
    return {
      userId: easyAuthUserId,
      authMode: "easyauth",
      scopes: [],
    };
  }

  // Both methods failed
  return undefined;
}
