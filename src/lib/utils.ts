import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCsrfTokenFromCookie() {
  if (typeof document === "undefined") return "";
  const csrf = document.cookie
    .split("; ")
    .find((item) => item.startsWith("csrf_token="))
    ?.split("=")[1];
  return csrf ?? "";
}
