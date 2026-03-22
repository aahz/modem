export async function api<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const errorText =
      typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    const details =
      typeof body.details === "string"
        ? body.details
        : typeof body.code === "string"
          ? body.code
          : "";
    throw new Error(details ? `${errorText}: ${details}` : errorText);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
