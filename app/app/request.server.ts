/**
 * Whether a request that changes something came from this app's own pages on this computer. The
 * Origin must match the Host, and the Host must be localhost, so a page on another site can't send
 * one, even after pointing its own name at this computer.
 */
export function fromApp(request: Request) {
  const host = request.headers.get("host") ?? "";
  const name = host.replace(/:\d+$/, "");
  return request.headers.get("origin") === `http://${host}` && (name === "localhost" || name === "127.0.0.1");
}
