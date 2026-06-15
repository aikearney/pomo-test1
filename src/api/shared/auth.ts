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
