import { useAppStore } from "../store/useAppStore";
import { Language, TranslationSchema } from "./types";
import { en } from "./locales/en";
import { vi } from "./locales/vi";

export const translations: Record<Language, TranslationSchema> = {
  en,
  vi,
};

export function getTranslation(lang: Language): TranslationSchema {
  return translations[lang] || translations.en;
}

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  const t = getTranslation(language);

  return {
    language,
    setLanguage,
    t,
  };
}

export * from "./types";
