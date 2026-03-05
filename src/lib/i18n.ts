type Lang = 'en' | 'hi' | 'mr'

type Dict = Record<string, string>

import { useEffect, useState } from 'react'

const dictionaries: Record<Lang, Dict> = {
  en: {
    'nav.home': 'Home',
    'nav.community': 'Community',
    'nav.my_reports': 'My Reports',
    'nav.leaders': 'Leaders',
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.register': 'Register',
    'auth.name': 'Name',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.need_account': 'Need an account? Register',
    'auth.have_account': 'Have an account? Login',
    'lang.english': 'English',
    'lang.hindi': 'Hindi',
    'lang.marathi': 'Marathi',

    'home.title_line1': 'Empower Your Voice,',
    'home.title_line2': 'Transform Your City',
    'home.subtitle': 'Report civic issues instantly. Track progress in real-time. Build a better community together.',
    'home.cta_report': 'Report an Issue',
    'home.cta_feed': 'View Community Feed',
    'home.stats.issues_reported': 'Issues Reported',
    'home.stats.issues_resolved': 'Issues Resolved',
    'home.stats.in_progress': 'In Progress',
    'home.loading': 'Loading overview…',

    'community.title': 'Community Feed',
    'community.cta_report': 'Report Issue',
    'community.empty': 'No reports yet. Be the first to report an issue.',
    'community.type': 'Type:',
    'community.comment': 'Comment',
    'community.view': 'View',
    'community.loading': 'Loading feed…',
    'community.load_more': 'Load more',
    'community.loading_more': 'Loading…',

    'leaders.title': 'Top Reporters',
    'leaders.subtitle': 'Karma grows with more reports. Celebrate active citizens!',
    'leaders.empty': 'No reports yet.',
    'leaders.loading': 'Loading leaders…',

    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.appearance_sub': 'Choose how NagrikGPT looks on your device.',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.system': 'System',
    'settings.current_theme': 'Current theme:',

    'profile.loading': 'Loading your reports…',
    'profile.user': 'User',
    'profile.reports_submitted': 'Reports submitted',
    'profile.karma_popularity': 'Karma · Popularity',
    'profile.empty': 'You have not submitted any reports yet.',
    'profile.department': 'Department',
    'profile.officer': 'Officer',
    'profile.reported_at': 'Reported at',
    'profile.reporter': 'Reporter',
    'profile.progress_timeline': 'Progress timeline',
    'profile.last_update_on': 'Last update on',
    'profile.no_timeline': 'No timeline updates yet.',
    'profile.view_details': 'View details',
    'profile.not_assigned_yet': 'Not assigned yet',
    'profile.unassigned': 'Unassigned',

    'map.title': 'Map',
    'map.tap_to_report': 'Tap on map to start a report',

    'report.submit': 'Submit report',
    'report.submitting': 'Submitting…',

    'misc.unknown_location': 'Unknown location',
  },
  hi: {
    'nav.home': 'होम',
    'nav.community': 'समुदाय',
    'nav.my_reports': 'मेरी रिपोर्ट',
    'nav.leaders': 'लीडर्स',
    'auth.login': 'लॉगिन',
    'auth.logout': 'लॉगआउट',
    'auth.register': 'रजिस्टर',
    'auth.name': 'नाम',
    'auth.email': 'ईमेल',
    'auth.password': 'पासवर्ड',
    'auth.need_account': 'अकाउंट नहीं है? Register करें',
    'auth.have_account': 'अकाउंट है? Login करें',
    'lang.english': 'अंग्रेज़ी',
    'lang.hindi': 'हिंदी',
    'lang.marathi': 'मराठी',

    'home.title_line1': 'अपनी आवाज़ बुलंद करें,',
    'home.title_line2': 'अपने शहर को बदलें',
    'home.subtitle': 'तुरंत नागरिक समस्याएँ रिपोर्ट करें। रियल-टाइम में प्रगति ट्रैक करें। मिलकर बेहतर समुदाय बनाएं।',
    'home.cta_report': 'समस्या रिपोर्ट करें',
    'home.cta_feed': 'समुदाय फीड देखें',
    'home.stats.issues_reported': 'रिपोर्ट की गई समस्याएँ',
    'home.stats.issues_resolved': 'समाधान हुई समस्याएँ',
    'home.stats.in_progress': 'प्रगति में',
    'home.loading': 'ओवरव्यू लोड हो रहा है…',

    'community.title': 'समुदाय फीड',
    'community.cta_report': 'समस्या रिपोर्ट करें',
    'community.empty': 'अभी कोई रिपोर्ट नहीं। पहली रिपोर्ट आप करें।',
    'community.type': 'प्रकार:',
    'community.comment': 'टिप्पणी',
    'community.view': 'देखें',
    'community.loading': 'फीड लोड हो रही है…',
    'community.load_more': 'और लोड करें',
    'community.loading_more': 'लोड हो रहा है…',

    'leaders.title': 'शीर्ष रिपोर्टर्स',
    'leaders.subtitle': 'ज़्यादा रिपोर्ट = ज़्यादा कर्मा। सक्रिय नागरिकों का जश्न मनाएं!',
    'leaders.empty': 'अभी कोई रिपोर्ट नहीं।',
    'leaders.loading': 'लीडर्स लोड हो रहे हैं…',

    'settings.title': 'सेटिंग्स',
    'settings.appearance': 'रूप',
    'settings.appearance_sub': 'अपने डिवाइस पर NagrikGPT का रूप चुनें।',
    'settings.light': 'प्रकाश',
    'settings.dark': 'अंधकार',
    'settings.system': 'प्रणाली',
    'settings.current_theme': 'वर्तमान थीम:',

    'profile.loading': 'आपकी रिपोर्ट्स लोड हो रही हैं…',
    'profile.user': 'उपयोगकर्ता',
    'profile.reports_submitted': 'रिपोर्ट्स जमा की गईं',
    'profile.karma_popularity': 'कर्मा · लोकप्रियता',
    'profile.empty': 'आपने अभी तक कोई रिपोर्ट जमा नहीं की है।',
    'profile.department': 'विभाग',
    'profile.officer': 'अधिकारी',
    'profile.reported_at': 'रिपोर्ट की गई तिथि',
    'profile.reporter': 'रिपोर्टर',
    'profile.progress_timeline': 'प्रगति का समयरेखा',
    'profile.last_update_on': 'अंतिम अद्यतन तिथि',
    'profile.no_timeline': 'अभी तक कोई समयरेखा अद्यतन नहीं है।',
    'profile.view_details': 'विवरण देखें',
    'profile.not_assigned_yet': 'अभी तक असाइन नहीं किया गया',
    'profile.unassigned': 'असाइन नहीं किया गया',

    'map.title': 'मानचित्र',
    'map.tap_to_report': 'रिपोर्ट शुरू करने के लिए मानचित्र पर टैप करें',

    'report.submit': 'रिपोर्ट जमा करें',
    'report.submitting': 'जमा करने की प्रक्रिया में…',

    'misc.unknown_location': 'अज्ञात स्थान',
  },
  mr: {
    'nav.home': 'मुख्यपृष्ठ',
    'nav.community': 'समुदाय',
    'nav.my_reports': 'माझे रिपोर्ट्स',
    'nav.leaders': 'लीडर्स',
    'auth.login': 'लॉगिन',
    'auth.logout': 'लॉगआउट',
    'auth.register': 'रजिस्टर',
    'auth.name': 'नाव',
    'auth.email': 'ईमेल',
    'auth.password': 'पासवर्ड',
    'auth.need_account': 'अकाउंट नाही? रजिस्टर करा',
    'auth.have_account': 'अकाउंट आहे? लॉगिन करा',
    'lang.english': 'इंग्रजी',
    'lang.hindi': 'हिंदी',
    'lang.marathi': 'मराठी',

    'home.title_line1': 'तुमचा आवाज मजबूत करा,',
    'home.title_line2': 'तुमचे शहर बदला',
    'home.subtitle': 'नागरिक समस्या लगेच नोंदवा. रिअल-टाइममध्ये प्रगती ट्रॅक करा. एकत्र चांगला समुदाय बनवा.',
    'home.cta_report': 'समस्या नोंदवा',
    'home.cta_feed': 'समुदाय फीड पाहा',
    'home.stats.issues_reported': 'नोंदवलेल्या समस्या',
    'home.stats.issues_resolved': 'सोडवलेल्या समस्या',
    'home.stats.in_progress': 'प्रगतीत',
    'home.loading': 'ओव्हरव्ह्यू लोड होत आहे…',

    'community.title': 'समुदाय फीड',
    'community.cta_report': 'समस्या नोंदवा',
    'community.empty': 'अजून रिपोर्ट नाहीत. पहिली रिपोर्ट तुम्ही करा.',
    'community.type': 'प्रकार:',
    'community.comment': 'टिप्पणी',
    'community.view': 'पाहा',
    'community.loading': 'फीड लोड होत आहे…',
    'community.load_more': 'आणखी लोड करा',
    'community.loading_more': 'लोड होत आहे…',

    'leaders.title': 'शीर्ष रिपोर्टर्स',
    'leaders.subtitle': 'जास्त रिपोर्ट = जास्त कर्मा. सक्रिय नागरिकांचे कौतुक करूया!',
    'leaders.empty': 'अजून रिपोर्ट नाहीत.',
    'leaders.loading': 'लीडर्स लोड होत आहेत…',

    'settings.title': 'सेटिंग्स',
    'settings.appearance': 'रूप',
    'settings.appearance_sub': 'तुमच्या डिव्हाइसवर NagrikGPT कसे दिसेल ते निवडा.',
    'settings.light': 'प्रकाश',
    'settings.dark': 'अंधकार',
    'settings.system': 'प्रणाली',
    'settings.current_theme': 'वर्तमान थीम:',

    'profile.loading': 'तुमचे रिपोर्ट्स लोड होत आहेत…',
    'profile.user': 'उपयोगकर्ता',
    'profile.reports_submitted': 'रिपोर्ट्स जमा केलेल्या',
    'profile.karma_popularity': 'कर्मा · लोकप्रियता',
    'profile.empty': 'तुम्ही अजून कोणतीही रिपोर्ट जमा केलेली नाही.',
    'profile.department': 'विभाग',
    'profile.officer': 'अधिकारी',
    'profile.reported_at': 'रिपोर्ट की गई तिथि',
    'profile.reporter': 'रिपोर्टर',
    'profile.progress_timeline': 'प्रगती का समयरेखा',
    'profile.last_update_on': 'अंतिम अद्यतन तिथि',
    'profile.no_timeline': 'अजून कोणतीही समयरेखा अद्यतन नाहीत.',
    'profile.view_details': 'विवरण पाहा',
    'profile.not_assigned_yet': 'अजून असाइन नाही',
    'profile.unassigned': 'असाइन नाही',

    'map.title': 'मानचित्र',
    'map.tap_to_report': 'रिपोर्ट सुरू करण्यासाठी मानचित्रावर टैप करा',

    'report.submit': 'रिपोर्ट जमा करा',
    'report.submitting': 'जमा करत आहे…',

    'misc.unknown_location': 'अज्ञात ठिकाण',
  },
}

function safeLang(v: unknown): Lang {
  return v === 'hi' || v === 'mr' || v === 'en' ? v : 'en'
}

export function getLang(): Lang {
  try {
    return safeLang(localStorage.getItem('nagrikGPT_lang'))
  } catch {
    return 'en'
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem('nagrikGPT_lang', lang)
  } catch {}
  try {
    window.dispatchEvent(new Event('nagrikGPT_lang_change'))
  } catch {}
}

export function t(key: string, fallback?: string): string {
  const lang = getLang()
  return dictionaries[lang][key] ?? dictionaries.en[key] ?? fallback ?? key
}

export function useLang(): Lang {
  const [lang, setLangState] = useState<Lang>(() => getLang())
  useEffect(() => {
    const onChange = () => setLangState(getLang())
    window.addEventListener('storage', onChange)
    window.addEventListener('nagrikGPT_lang_change', onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener('nagrikGPT_lang_change', onChange)
    }
  }, [])
  return lang
}
