const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function sanitizeText(input: string) {
  return input.replace(CONTROL_CHARS, "").replace(/[<>]/g, "").trim();
}
