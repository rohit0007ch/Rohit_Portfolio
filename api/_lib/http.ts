type JsonBody = Record<string, unknown>;

export function setCorsHeaders(
  res: {
    setHeader: (name: string, value: string) => void;
  },
  methods = 'POST, OPTIONS'
): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function sendJson(
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  status: number,
  body: JsonBody
): unknown {
  return res.status(status).json(body);
}

export function methodNotAllowed(
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  allowed: string
): unknown {
  return sendJson(res, 405, {
    success: false,
    message: `Method not allowed. Use ${allowed}.`,
  });
}

export function readJsonBody(req: { body?: unknown }): unknown {
  if (req.body == null || req.body === '') {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return req.body;
}
