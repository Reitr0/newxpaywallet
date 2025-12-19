// src/shared/infra/locale/localeStore.js
import { proxy } from 'valtio';
import { I18nManager, Platform } from 'react-native';
import log from '@src/shared/infra/log/logService';
import i18n from 'i18next';
import { localeService } from '@features/settings/locale/service/localeService';
let RNLocalize = null;
try {
  RNLocalize = require('react-native-localize');
} catch {
  RNLocalize = null;
}

/** Supported UI languages (keys should match your i18n namespaces) */
export const LANGUAGES = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Español' },
  { key: 'fr', label: 'Français' },
  { key: 'de', label: 'Deutsch' },
  { key: 'pt', label: 'Português' },
  { key: 'tr', label: 'Türkçe' },
  { key: 'vi', label: 'Tiếng Việt' },
  { key: 'id', label: 'Bahasa Indonesia' },
  { key: 'zh', label: '简体中文' },
  { key: 'ja', label: '日本語' },
  { key: 'ko', label: '한국어' },
];

// Languages that typically use RTL layout
const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur']);

/** Resolve the best language key from device settings */
function detectDeviceLanguageKey() {
  try {
    if (RNLocalize && typeof RNLocalize.getLocales === 'function') {
      const locales = RNLocalize.getLocales();
      const best = Array.isArray(locales) && locales.length ? locales[0] : null;
      const candidate =
        best?.languageTag || best?.languageCode || best?.language || 'en';

      const key = candidate.toLowerCase();
      // Try direct match (e.g. 'en', 'vi', 'zh')
      if (LANGUAGES.some(l => l.key === key)) return key;

      // Try language code from 'en-US' → 'en'
      const short = key.split('-')[0];
      if (LANGUAGES.some(l => l.key === short)) return short;
    }
  } catch (e) {
    log.warn('localeStore.detectDeviceLanguageKey failed', { message: e?.message });
  }
  return 'en';
}

/** Whether a language key should use RTL layout */
function isRtlLang(langKey) {
  const k = String(langKey || '').split('-')[0].toLowerCase();
  return RTL_LANGS.has(k);
}

/** Apply i18n language change safely */
async function applyI18nLanguage(lang) {
  try {
    if (i18n?.changeLanguage) {
      await i18n.changeLanguage(lang);
      log.debug('localeStore.applyI18nLanguage ok', { lang });
    }
  } catch (e) {
    log.warn('localeStore.applyI18nLanguage failed', { message: e?.message, lang });
  }
}

/** Apply RTL to React Native layout (note: may require app reload for full effect) */
function applyRTL(rtl) {
  try {
    // Allow RTL globally
    if (I18nManager?.allowRTL) I18nManager.allowRTL(true);
    if (I18nManager?.forceRTL) I18nManager.forceRTL(!!rtl);

    // On Android an immediate layout direction update often needs an app restart
    // We won't hard-restart here; the app can show a toast asking the user to restart.
    log.debug('localeStore.applyRTL', { rtl, platform: Platform.OS });
  } catch (e) {
    log.warn('localeStore.applyRTL failed', { message: e?.message });
  }
}

export const localeStore = proxy({
  status: 'idle',      // 'idle' | 'loading' | 'ready' | 'error'
  error: null,

  language: 'en',      // i18n language key (e.g. 'en', 'vi', 'zh')
  locale: undefined,   // device/region flavor (e.g. 'en-US', 'vi-VN')
  rtl: false,          // layout direction
  languages: LANGUAGES,

  /** Initialize from persistence + device defaults */
  async init() {
    try {
      this.status = 'loading';
      this.error = null;

      const saved = localeService.get() || {};
      let lang = saved.language || detectDeviceLanguageKey();
      const deviceLocale = (() => {
        if (RNLocalize && typeof RNLocalize.getLocales === 'function') {
          const loc = RNLocalize.getLocales();
          return Array.isArray(loc) && loc.length ? loc[0]?.languageTag : undefined;
        }
        return undefined;
      })();

      const rtl = saved.rtl != null ? !!saved.rtl : isRtlLang(lang);
      const loc = saved.locale || deviceLocale;

      // Apply
      await applyI18nLanguage(lang);
      applyRTL(rtl);

      // Persist any resolved defaults
      localeService.update({ language: lang, rtl, locale: loc });

      // Store
      this.language = lang;
      this.locale = loc;
      this.rtl = rtl;

      this.status = 'ready';
      log.info('localeStore.init ok', { language: lang, locale: loc, rtl });
    } catch (e) {
      this.status = 'error';
      this.error = e?.message || 'Failed to init locale';
      log.warn('localeStore.init failed', { message: e?.message });
    }
  },

  /** Set language key and apply immediately */
  async setLanguage(langKey) {
    try {
      const supported = LANGUAGES.some(l => l.key === langKey);
      const lang = supported ? langKey : 'en';
      const nextRTL = isRtlLang(lang);

      await applyI18nLanguage(lang);
      applyRTL(nextRTL);

      this.language = lang;
      this.rtl = nextRTL;

      localeService.update({ language: lang, rtl: nextRTL });
      log.info('localeStore.setLanguage ok', { language: lang, rtl: nextRTL });
    } catch (e) {
      log.warn('localeStore.setLanguage failed', { message: e?.message, langKey });
    }
  },

  /** Set locale (e.g. 'en-US', affects number/date formatting in your app code) */
  setLocale(locale) {
    try {
      this.locale = locale;
      localeService.setLocale(locale);
      log.debug('localeStore.setLocale ok', { locale });
    } catch (e) {
      log.warn('localeStore.setLocale failed', { message: e?.message, locale });
    }
  },

  /** Explicitly set RTL on/off (rarely needed; language normally controls this) */
  setRTL(flag) {
    try {
      const rtl = !!flag;
      this.rtl = rtl;
      applyRTL(rtl);
      localeService.setRTL(rtl);
      log.debug('localeStore.setRTL ok', { rtl });
    } catch (e) {
      log.warn('localeStore.setRTL failed', { message: e?.message });
    }
  },

  /** Helpers */
  getSupportedLanguages() {
    return this.languages;
  },

  getLanguageLabel(key) {
    return this.languages.find(l => l.key === key)?.label || key;
  },
});
