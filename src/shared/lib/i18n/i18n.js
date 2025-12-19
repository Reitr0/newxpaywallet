import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';

// Import all locales
import { en } from '@src/shared/lib/i18n/locales/en';
import { es } from '@src/shared/lib/i18n/locales/es';
import { fr } from '@src/shared/lib/i18n/locales/fr';
import { de } from '@src/shared/lib/i18n/locales/de';
import { pt } from '@src/shared/lib/i18n/locales/pt';
import { tr } from '@src/shared/lib/i18n/locales/tr';
import { vi } from '@src/shared/lib/i18n/locales/vi';
import { id } from '@src/shared/lib/i18n/locales/id';
import { zh } from '@src/shared/lib/i18n/locales/zh';
import { ja } from '@src/shared/lib/i18n/locales/ja';
import { ko } from '@src/shared/lib/i18n/locales/ko';

const resources = {
  en: en,
  es: es,
  fr: fr,
  de: de,
  pt: pt,
  tr: tr,
  vi: vi,
  id: id,
  zh: zh,
  ja: ja,
  ko: ko,
};

const fallback = { languageTag: 'en', isRTL: false };

// This will now check against all the keys in the resources object above
const { languageTag } = RNLocalize.findBestLanguageTag(Object.keys(resources)) || fallback;

i18n
  .use(initReactI18next)
  .init({
    debug: false,
    compatibilityJSON: 'v3',
    resources,
    lng: languageTag, // detected language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
