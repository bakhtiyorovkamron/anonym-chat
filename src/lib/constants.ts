export const COOKIE_NAMES = {
  user: "anon_session",
  admin: "admin_session",
  csrf: "csrf_token",
} as const;

export const INTERESTS = [
  "Общение",
  "Знакомства",
  "Флирт",
  "Roleplay",
  "Музыка",
  "Игры",
  "Кино",
  "Путешествия",
  "Мемы",
  "Отношения",
  "Разговоры ночью",
  "Другое",
] as const;

export const MODE_OPTIONS = [
  { value: "TALK", label: "💬 Просто поговорить" },
  { value: "DATE", label: "❤️ Познакомиться" },
  { value: "FLIRT", label: "😏 Флирт" },
  { value: "ROLEPLAY", label: "🎭 Roleplay" },
  { value: "COMPANY", label: "🫶 Найти компанию" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "RUSSIAN", label: "Русский" },
  { value: "ENGLISH", label: "English" },
  { value: "UZBEK", label: "Uzbek" },
] as const;

export const REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "SEXUAL_HARASSMENT",
  "SCAM",
  "THREATS",
  "PERSONAL_INFORMATION",
  "SUSPECTED_MINOR",
  "OTHER",
] as const;
