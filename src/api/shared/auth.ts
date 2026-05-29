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

export function getUserId(req: any): string | undefined {
  const principalId = getHeader(req, "x-ms-client-principal-id");
  if (principalId) {
    return principalId;
  }

  const encodedPrincipal = getHeader(req, "x-ms-client-principal");
  if (encodedPrincipal) {
    try {
      const decoded = JSON.parse(Buffer.from(encodedPrincipal, "base64").toString("utf8"));
      return decoded.userId || decoded.userDetails || decoded.claims?.find?.((claim: any) => claim.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.val;
    } catch {
      return undefined;
    }
  }

  return getHeader(req, "x-ms-client-principal-name") || undefined;
}
