// Whether cookies get the `secure` flag (sent only over HTTPS).
// Defaults to true in production. Set COOKIE_SECURE=false only while serving over plain HTTP
// (e.g. http://<server-ip>:4000 before HTTPS is set up), otherwise browsers drop the cookies.
export const COOKIE_SECURE =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";
