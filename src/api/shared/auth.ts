function getHeader(req: any, name: string): string | undefined {
  const headers = req?.headers;
  if (!headers) {
    return undefined;
  }

  const direct = headers[name];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const match = Object.entries(headers).find(
    ([headerName, value]) =>
      headerName.toLowerCase() === name.toLowerCase() && typeof value === "string" && value.length > 0,
  );

  return match?.[1] as string | undefined;
}

/**
 * Extract user ID from Azure Easy Auth headers.
 * These headers are set by Azure App Service authentication middleware.
 * Priority: x-ms-client-principal-id > decoded x-ms-client-principal > x-ms-client-principal-name
 */
export function getUserId(req: any): string | undefined {
  const principalId = getHeader(req, "x-ms-client-principal-id");
  if (principalId) {
    return principalId;
  }

  const encodedPrincipal = getHeader(req, "x-ms-client-principal");
  if (encodedPrincipal) {
    try {
      const decoded = JSON.parse(Buffer.from(encodedPrincipal, "base64").toString("utf8"));
      // Handle various Azure Easy Auth response formats
      return (
        decoded.userId ||
        decoded.userDetails ||
        decoded.sub ||
        decoded.claims?.find?.((claim: any) => claim.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.val
      );
    } catch (e) {
      console.error("Failed to decode x-ms-client-principal header:", e);
      return undefined;
    }
  }

  return getHeader(req, "x-ms-client-principal-name") || undefined;
}

/**
 * Get user display name from Azure Easy Auth headers.
 */
export function getUserDisplayName(req: any): string | undefined {
  const encodedPrincipal = getHeader(req, "x-ms-client-principal");
  if (encodedPrincipal) {
    try {
      const decoded = JSON.parse(Buffer.from(encodedPrincipal, "base64").toString("utf8"));
      return decoded.userDetails || decoded.name || undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

