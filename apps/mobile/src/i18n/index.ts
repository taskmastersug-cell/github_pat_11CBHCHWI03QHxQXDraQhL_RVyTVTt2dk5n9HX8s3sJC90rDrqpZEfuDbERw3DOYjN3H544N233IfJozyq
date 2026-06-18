import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import en from './locales/en.json';
import lg from './locales/lg.json';

const LOCALE_KEY = 'roundpay.locale';

export type AppLocale = 'en' | 'lg';

export async function initI18n(): Promise<void> {
  let stored: string | null = null;
  try { stored = await SecureStore.getItemAsync(LOCALE_KEY); } catch { stored = null; }
  const lng: AppLocale = stored === 'lg' ? 'lg' : 'en';
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, lg: { translation: lg } },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export async function setLocale(locale: AppLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  try { await SecureStore.setItemAsync(LOCALE_KEY, locale); } catch {}
}

export { i18n };
