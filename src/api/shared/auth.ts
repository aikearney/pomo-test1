export function getUserId(req: any): string {
  const header = req.headers["x-ms-client-principal"];
  if (!header) throw new Error("Missing auth header");

  const decoded = JSON.parse(Buffer.from(header, "base64").toString("ascii"));
  return decoded.userId || decoded.userDetails;
}
