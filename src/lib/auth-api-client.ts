export class AuthRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthRequestError";
  }
}

export async function postAuthJson<T>(url: string, body: unknown) {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthRequestError("No pudimos conectar con el servicio de acceso. Revisa tu conexión e inténtalo de nuevo.");
  }

  let payload: T;

  try {
    payload = (await response.json()) as T;
  } catch {
    throw new AuthRequestError("El servicio de acceso respondió de forma inesperada. Inténtalo de nuevo.");
  }

  return {
    ok: response.ok,
    payload,
  };
}

export function getAuthRequestMessage(error: unknown, fallback: string) {
  return error instanceof AuthRequestError ? error.message : fallback;
}
