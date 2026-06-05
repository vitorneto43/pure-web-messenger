// Translation resources for WaveChat global campaign.
// Keep keys flat-ish; add new keys as features are localized.

export type Locale =
  | "pt"
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "ar"
  | "hi"
  | "zh"
  | "ja";

export const SUPPORTED_LOCALES: Locale[] = [
  "pt",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "ar",
  "hi",
  "zh",
  "ja",
];

export const LOCALE_LABELS: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ar: "العربية",
  hi: "हिन्दी",
  zh: "中文",
  ja: "日本語",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  pt: "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  ar: "🇸🇦",
  hi: "🇮🇳",
  zh: "🇨🇳",
  ja: "🇯🇵",
};

export const HTML_LANG: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  ar: "ar",
  hi: "hi",
  zh: "zh-CN",
  ja: "ja",
};

export const RTL_LOCALES: Locale[] = ["ar"];

// Map ISO-3166 country code -> default locale.
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
  US: "en", GB: "en", CA: "en", AU: "en", NZ: "en", IE: "en", ZA: "en", NG: "en", IN: "en",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", UY: "es", PY: "es", BO: "es", EC: "es", CR: "es", PA: "es", DO: "es", GT: "es", HN: "es", SV: "es", NI: "es", CU: "es", PR: "es",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", SN: "fr", CI: "fr", CM: "fr", MA: "fr", TN: "fr", DZ: "fr",
  DE: "de", AT: "de", CH: "de",
  IT: "it", SM: "it", VA: "it",
  SA: "ar", AE: "ar", EG: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", JO: "ar", LB: "ar", SY: "ar", IQ: "ar", YE: "ar", LY: "ar", SD: "ar",
  CN: "zh", TW: "zh", HK: "zh", SG: "zh", MO: "zh",
  JP: "ja",
};

type Dict = Record<string, string>;

const pt: Dict = {
  "nav.about": "Sobre",
  "nav.howItWorks": "Como funciona",
  "nav.support": "Suporte",
  "nav.signIn": "Entrar",
  "nav.contact": "Contato",
  "footer.tagline": "Grupos, mensagens, chamadas de áudio e vídeo e IA — tudo em um só lugar.",
  "footer.institutional": "Institucional",
  "footer.help": "Ajuda",
  "footer.contactUs": "Fale conosco",
  "footer.privacy": "Política de Privacidade",
  "footer.terms": "Termos de Uso",
  "footer.aboutLink": "Sobre o WaveChat",
  "footer.guideLink": "Como funciona",
  "footer.rights": "© 2025 WaveChat. Todos os direitos reservados.",
  "footer.madeWith": "Feito com ♥ no Brasil",
  "common.language": "Idioma",
  "cta.getStarted": "Comece grátis",
  "cta.download": "Baixar app",
  "hero.title": "Converse com o mundo todo, do seu navegador",
  "hero.subtitle":
    "Mensagens, chamadas de voz e vídeo, status, Pix e IA em um só lugar. Sem instalar nada da loja.",
};

const en: Dict = {
  "nav.about": "About",
  "nav.howItWorks": "How it works",
  "nav.support": "Support",
  "nav.signIn": "Sign in",
  "nav.contact": "Contact",
  "footer.tagline": "Groups, messages, voice & video calls and AI — all in one place.",
  "footer.institutional": "Company",
  "footer.help": "Help",
  "footer.contactUs": "Contact us",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Use",
  "footer.aboutLink": "About WaveChat",
  "footer.guideLink": "How it works",
  "footer.rights": "© 2025 WaveChat. All rights reserved.",
  "footer.madeWith": "Made with ♥ in Brazil",
  "common.language": "Language",
  "cta.getStarted": "Get started free",
  "cta.download": "Download app",
  "hero.title": "Chat with the whole world, right from your browser",
  "hero.subtitle":
    "Messaging, voice & video calls, status, payments and AI in one place. No app store install required.",
};

const es: Dict = {
  "nav.about": "Acerca",
  "nav.howItWorks": "Cómo funciona",
  "nav.support": "Soporte",
  "nav.signIn": "Entrar",
  "nav.contact": "Contacto",
  "footer.tagline": "Grupos, mensajes, llamadas de voz y video e IA — todo en un solo lugar.",
  "footer.institutional": "Empresa",
  "footer.help": "Ayuda",
  "footer.contactUs": "Contáctanos",
  "footer.privacy": "Política de Privacidad",
  "footer.terms": "Términos de Uso",
  "footer.aboutLink": "Acerca de WaveChat",
  "footer.guideLink": "Cómo funciona",
  "footer.rights": "© 2025 WaveChat. Todos los derechos reservados.",
  "footer.madeWith": "Hecho con ♥ en Brasil",
  "common.language": "Idioma",
  "cta.getStarted": "Empezar gratis",
  "cta.download": "Descargar app",
  "hero.title": "Habla con todo el mundo, desde tu navegador",
  "hero.subtitle":
    "Mensajería, llamadas de voz y video, estados, pagos e IA en un solo lugar. Sin instalar nada.",
};

const fr: Dict = {
  "nav.about": "À propos",
  "nav.howItWorks": "Comment ça marche",
  "nav.support": "Support",
  "nav.signIn": "Se connecter",
  "nav.contact": "Contact",
  "footer.tagline": "Groupes, messages, appels audio/vidéo et IA — tout au même endroit.",
  "footer.institutional": "Entreprise",
  "footer.help": "Aide",
  "footer.contactUs": "Nous contacter",
  "footer.privacy": "Politique de confidentialité",
  "footer.terms": "Conditions d’utilisation",
  "footer.aboutLink": "À propos de WaveChat",
  "footer.guideLink": "Comment ça marche",
  "footer.rights": "© 2025 WaveChat. Tous droits réservés.",
  "footer.madeWith": "Fait avec ♥ au Brésil",
  "common.language": "Langue",
  "cta.getStarted": "Commencer gratuitement",
  "cta.download": "Télécharger l’app",
  "hero.title": "Discutez avec le monde entier depuis votre navigateur",
  "hero.subtitle":
    "Messages, appels vocaux et vidéo, statuts, paiements et IA au même endroit. Sans installer d’app.",
};

const de: Dict = {
  "nav.about": "Über uns",
  "nav.howItWorks": "Funktionsweise",
  "nav.support": "Support",
  "nav.signIn": "Anmelden",
  "nav.contact": "Kontakt",
  "footer.tagline": "Gruppen, Nachrichten, Audio- und Videoanrufe und KI — alles an einem Ort.",
  "footer.institutional": "Unternehmen",
  "footer.help": "Hilfe",
  "footer.contactUs": "Kontakt",
  "footer.privacy": "Datenschutzerklärung",
  "footer.terms": "Nutzungsbedingungen",
  "footer.aboutLink": "Über WaveChat",
  "footer.guideLink": "Funktionsweise",
  "footer.rights": "© 2025 WaveChat. Alle Rechte vorbehalten.",
  "footer.madeWith": "Mit ♥ in Brasilien gemacht",
  "common.language": "Sprache",
  "cta.getStarted": "Kostenlos starten",
  "cta.download": "App herunterladen",
  "hero.title": "Chatte mit der ganzen Welt — direkt im Browser",
  "hero.subtitle":
    "Nachrichten, Sprach- und Videoanrufe, Status, Zahlungen und KI an einem Ort. Ohne App-Store-Installation.",
};

const it: Dict = {
  "nav.about": "Chi siamo",
  "nav.howItWorks": "Come funziona",
  "nav.support": "Supporto",
  "nav.signIn": "Accedi",
  "nav.contact": "Contatti",
  "footer.tagline": "Gruppi, messaggi, chiamate audio e video e IA — tutto in un unico posto.",
  "footer.institutional": "Azienda",
  "footer.help": "Aiuto",
  "footer.contactUs": "Contattaci",
  "footer.privacy": "Informativa sulla privacy",
  "footer.terms": "Termini di utilizzo",
  "footer.aboutLink": "Chi è WaveChat",
  "footer.guideLink": "Come funziona",
  "footer.rights": "© 2025 WaveChat. Tutti i diritti riservati.",
  "footer.madeWith": "Fatto con ♥ in Brasile",
  "common.language": "Lingua",
  "cta.getStarted": "Inizia gratis",
  "cta.download": "Scarica l’app",
  "hero.title": "Chatta con il mondo, direttamente dal browser",
  "hero.subtitle":
    "Messaggi, chiamate audio e video, stati, pagamenti e IA in un unico posto. Nessuna installazione richiesta.",
};

const ar: Dict = {
  "nav.about": "حول",
  "nav.howItWorks": "كيف يعمل",
  "nav.support": "الدعم",
  "nav.signIn": "تسجيل الدخول",
  "nav.contact": "اتصل بنا",
  "footer.tagline": "مجموعات، رسائل، مكالمات صوت وفيديو وذكاء اصطناعي — كل ذلك في مكان واحد.",
  "footer.institutional": "الشركة",
  "footer.help": "المساعدة",
  "footer.contactUs": "تواصل معنا",
  "footer.privacy": "سياسة الخصوصية",
  "footer.terms": "شروط الاستخدام",
  "footer.aboutLink": "حول WaveChat",
  "footer.guideLink": "كيف يعمل",
  "footer.rights": "© 2025 WaveChat. جميع الحقوق محفوظة.",
  "footer.madeWith": "صُنع بحب في البرازيل",
  "common.language": "اللغة",
  "cta.getStarted": "ابدأ مجانًا",
  "cta.download": "تنزيل التطبيق",
  "hero.title": "تحدّث مع العالم كله من متصفحك",
  "hero.subtitle":
    "رسائل، مكالمات صوت وفيديو، حالات، مدفوعات وذكاء اصطناعي في مكان واحد. بدون أي تثبيت.",
};

const hi: Dict = {
  "nav.about": "हमारे बारे में",
  "nav.howItWorks": "यह कैसे काम करता है",
  "nav.support": "सहायता",
  "nav.signIn": "साइन इन",
  "nav.contact": "संपर्क",
  "footer.tagline": "ग्रुप, संदेश, ऑडियो और वीडियो कॉल और एआई — सब एक ही जगह।",
  "footer.institutional": "कंपनी",
  "footer.help": "मदद",
  "footer.contactUs": "संपर्क करें",
  "footer.privacy": "गोपनीयता नीति",
  "footer.terms": "उपयोग की शर्तें",
  "footer.aboutLink": "WaveChat के बारे में",
  "footer.guideLink": "यह कैसे काम करता है",
  "footer.rights": "© 2025 WaveChat. सर्वाधिकार सुरक्षित।",
  "footer.madeWith": "ब्राज़ील में ♥ से बनाया गया",
  "common.language": "भाषा",
  "cta.getStarted": "मुफ़्त शुरू करें",
  "cta.download": "ऐप डाउनलोड करें",
  "hero.title": "अपने ब्राउज़र से पूरी दुनिया से बात करें",
  "hero.subtitle":
    "संदेश, वॉइस और वीडियो कॉल, स्टेटस, भुगतान और एआई एक ही जगह। कोई ऐप इंस्टॉल नहीं।",
};

const zh: Dict = {
  "nav.about": "关于",
  "nav.howItWorks": "工作原理",
  "nav.support": "支持",
  "nav.signIn": "登录",
  "nav.contact": "联系",
  "footer.tagline": "群组、消息、语音和视频通话以及 AI — 一站式体验。",
  "footer.institutional": "公司",
  "footer.help": "帮助",
  "footer.contactUs": "联系我们",
  "footer.privacy": "隐私政策",
  "footer.terms": "使用条款",
  "footer.aboutLink": "关于 WaveChat",
  "footer.guideLink": "工作原理",
  "footer.rights": "© 2025 WaveChat。版权所有。",
  "footer.madeWith": "在巴西用 ♥ 制作",
  "common.language": "语言",
  "cta.getStarted": "免费开始",
  "cta.download": "下载应用",
  "hero.title": "在浏览器里与全世界畅聊",
  "hero.subtitle": "消息、语音和视频通话、状态、支付和 AI 一站式体验。无需安装应用。",
};

const ja: Dict = {
  "nav.about": "概要",
  "nav.howItWorks": "使い方",
  "nav.support": "サポート",
  "nav.signIn": "ログイン",
  "nav.contact": "お問い合わせ",
  "footer.tagline": "グループ、メッセージ、音声・ビデオ通話、AI — すべて一か所で。",
  "footer.institutional": "会社情報",
  "footer.help": "ヘルプ",
  "footer.contactUs": "お問い合わせ",
  "footer.privacy": "プライバシーポリシー",
  "footer.terms": "利用規約",
  "footer.aboutLink": "WaveChat について",
  "footer.guideLink": "使い方",
  "footer.rights": "© 2025 WaveChat. 無断複写・転載を禁じます。",
  "footer.madeWith": "ブラジルから ♥ を込めて",
  "common.language": "言語",
  "cta.getStarted": "無料で始める",
  "cta.download": "アプリをダウンロード",
  "hero.title": "ブラウザから世界中とチャット",
  "hero.subtitle":
    "メッセージ、音声・ビデオ通話、ステータス、決済、AI を一か所で。アプリのインストール不要。",
};

export const RESOURCES: Record<Locale, { translation: Dict }> = {
  pt: { translation: pt },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  ar: { translation: ar },
  hi: { translation: hi },
  zh: { translation: zh },
  ja: { translation: ja },
};
