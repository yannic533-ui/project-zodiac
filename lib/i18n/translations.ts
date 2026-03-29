export const LOCALE_STORAGE_KEY = "schnuffis-locale";

export type Locale = "de" | "en";

export type OnboardingQaKey = "special" | "story" | "regulars" | "insider";

/** UI copy used with `t("…")` — keys shared across locales. */
export const UI = {
  de: {
    // Common
    common_loading: "…",
    common_back: "← Zurück",
    common_none: "Keine",
    common_optional: "Optional",

    // Locale toggle aria
    lang_toggle_aria: "Sprache wählen",

    // Home /
    home_kicker: "Schnuffis",
    home_title: "Schnitzeljagd für Bars — über Telegram",
    home_body:
      "Melde deinen Betrieb mit Google Places an, lass Claude Rätsel entwerfen und führe Live-Events für Gruppen in deiner Stadt. Spieler chatten mit dem Boten auf Telegram, während sie von Station zu Station ziehen.",
    home_cta_signin: "Registrieren / Anmelden",
    home_cta_admin: "Super-Admin",

    // Login
    login_title: "Anmelden",
    login_subtitle:
      "Wir schicken dir einen Magic Link per E-Mail. Kein Passwort.",
    login_placeholder_email: "du@beispiel.ch",
    login_error_auth: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
    login_error_profile:
      "Profil konnte nicht eingerichtet werden. Bitte Support kontaktieren.",
    login_success_email: "Prüfe deine E-Mail für den Anmeldelink.",
    login_error_generic: "Etwas ist schiefgelaufen.",
    login_btn_submit: "Link per E-Mail senden",
    login_back_home: "Zur Startseite",

    // Dashboard shell
    dash_brand: "Schnuffis — deine Bars",
    dash_nav_overview: "Übersicht",
    dash_nav_bars: "Meine Bars",
    dash_nav_riddles: "Meine Rätsel",
    dash_nav_events: "Events",
    dash_nav_live: "Live",
    dash_nav_message: "Nachricht senden",
    dash_nav_onboarding: "Bar hinzufügen",
    dash_logout: "Abmelden",

    // Dashboard overview
    dash_over_title: "Übersicht",
    dash_over_err: "Übersicht konnte nicht geladen werden.",
    dash_over_bars: "Deine Bars",
    dash_over_manage: "Verwalten →",
    dash_over_active_event: "Aktives Event",
    dash_over_events_link: "Events →",
    dash_over_live_groups: "Live-Gruppen (dein aktives Event)",
    dash_over_live_link: "Live →",
    dash_over_onboard_prompt: "Noch ein Lokal?",
    dash_over_onboard_link: "Onboarding starten",

    // Dashboard bars
    dash_bars_title: "Meine Bars",
    dash_bars_add_title: "Bar hinzufügen",
    dash_bars_name_ph: "Name",
    dash_bars_address_ph: "Adresse",
    dash_bars_prize_ph: "Preis / Notizen",
    dash_bars_add_btn: "Hinzufügen",
    dash_bars_fail_create: "Anlegen fehlgeschlagen",
    dash_bars_active: "aktiv",
    dash_bars_inactive: "inaktiv",
    dash_bars_toggle: "Aktiv umschalten",
    dash_bars_delete: "Löschen",
    dash_bars_confirm_delete: "Bar und ihre Rätsel löschen?",

    // Dashboard riddles
    dash_riddles_title: "Meine Rätsel",
    dash_riddles_intro:
      "Wähle eine Bar, dann füge Rätsel hinzu oder prüfe sie. Schwierigkeit 1–3: leicht bis schwer.",
    dash_riddles_bar_label: "Bar",
    dash_riddles_add_title: "Rätsel hinzufügen",
    dash_riddles_q_ph: "Frage",
    dash_riddles_kw_ph: "Stichwörter, kommagetrennt",
    dash_riddles_diff_label: "Schwierigkeit",
    dash_riddles_diff_1: "1 — leicht",
    dash_riddles_diff_2: "2 — mittel",
    dash_riddles_diff_3: "3 — schwer",
    dash_riddles_hint1_ph: "Hinweis 1",
    dash_riddles_hint2_ph: "Hinweis 2",
    dash_riddles_add_btn: "Hinzufügen",
    dash_riddles_kw_label: "Stichwörter:",
    dash_riddles_delete: "Löschen",
    dash_riddles_confirm_delete: "Rätsel löschen?",
    dash_riddles_list_meta: "{bar} · Schwierigkeit {n}",

    // Dashboard events
    dash_events_title: "Events",
    dash_events_intro:
      "Global kann nur ein Event aktiv sein. Route nutzt deine aktiven Bars; leg die Reihenfolge fest.",
    dash_events_create_title: "Event erstellen",
    dash_events_name_ph: "Name",
    dash_events_route_label: "Route (deine aktiven Bars)",
    dash_events_create_btn: "Erstellen (inaktiv)",
    dash_events_active: "aktiv",
    dash_events_set_active: "Aktiv setzen",
    dash_events_deactivate: "Deaktivieren",
    dash_events_delete: "Löschen",
    dash_events_confirm_delete: "Event löschen?",
    dash_events_up: "hoch",
    dash_events_down: "runter",
    dash_events_remove: "entfernen",
    dash_events_invite_emails_label: "Co-Betreiber einladen (E-Mail, eine pro Zeile)",
    dash_events_invite_emails_ph: "name@bar.ch",
    dash_events_co_bars_label: "Deren Bar-IDs (UUID, kommagetrennt, optional)",
    dash_events_co_bars_ph: "uuid-1, uuid-2",
    dash_events_invited_list: "Eingeladen",

    // Dashboard live
    dash_live_title: "Live-Gruppen",
    dash_live_intro:
      "Gruppen in deinen Events. Aktualisiert regelmässig und bei Änderungen (Realtime, falls in Supabase aktiv).",
    dash_live_err: "Laden fehlgeschlagen",
    dash_live_empty: "Noch keine Gruppen in deinen Events.",
    dash_live_th_group: "Gruppe",
    dash_live_th_chat: "Chat-ID",
    dash_live_th_event: "Event",
    dash_live_th_state: "Status",
    dash_live_th_bar: "Bar",
    dash_live_th_pts: "Pkt",
    dash_live_th_lang: "Spr.",

    // Dashboard message
    dash_msg_title: "Nachricht senden",
    dash_msg_intro:
      "Nachricht an eine Telegram-Gruppe, die eines deiner Events spielt (Chat-ID verwenden).",
    dash_msg_chat_ph: "Telegram-Chat-ID",
    dash_msg_text_ph: "Nachricht",
    dash_msg_sent: "Gesendet.",
    dash_msg_fail: "Senden fehlgeschlagen",
    dash_msg_send: "Senden",

    // Onboarding
    ob_title: "Bar hinzufügen",
    ob_dashboard_link: "Dashboard",
    ob_step: "Schritt {step} von 3 — {label}",
    ob_step1_label: "Bar finden",
    ob_step2_label: "Mehr erzählen",
    ob_step3_label: "Rätsel",
    ob_q1_label: "Google-Maps-Link einfügen oder Barname suchen",
    ob_q1_ph: "Maps-Link oder Barname",
    ob_lookup: "Suchen",
    ob_pick_match: "Treffer wählen:",
    ob_preview: "Vorschau",
    ob_label_name: "Name",
    ob_label_address: "Adresse",
    ob_label_desc: "Beschreibung",
    ob_label_website: "Website",
    ob_label_phone: "Telefon",
    ob_categories: "Kategorien:",
    ob_hours: "Öffnungszeiten",
    ob_price_level: "Preisniveau: {n} (0–4)",
    ob_continue: "Weiter",
    ob_q_special: "Was macht eure Bar besonders?",
    ob_q_story: "Gibt es eine Geschichte hinter Name oder Ort?",
    ob_q_regulars: "Was bestellen Stammgäste immer?",
    ob_q_insider: "Was wüsste ein Insider, den ein Tourist nicht weiß?",
    ob_generate: "Rätsel generieren",
    ob_diff_easy: "Leicht",
    ob_diff_medium: "Mittel",
    ob_diff_hard: "Schwer",
    ob_regenerate: "Neu generieren",
    ob_label_question: "Frage",
    ob_label_keywords: "Antwort-Stichwörter (kommagetrennt)",
    ob_label_hint1: "Hinweis 1",
    ob_label_hint2: "Hinweis 2",
    ob_save: "Passt — Bar speichern",
    ob_saving: "Speichern…",

    // Onboarding errors (client)
    ob_err_search: "Suche fehlgeschlagen",
    ob_err_network: "Netzwerkfehler",
    ob_err_place: "Ort konnte nicht geladen werden",
    ob_err_generate: "Generierung fehlgeschlagen",
    ob_err_regen: "Neu generieren fehlgeschlagen",
    ob_err_save: "Speichern fehlgeschlagen",
  },
  en: {
    common_loading: "…",
    common_back: "← Back",
    common_none: "None",
    common_optional: "Optional",

    lang_toggle_aria: "Choose language",

    home_kicker: "Schnuffis",
    home_title: "Scavenger hunts for bars, powered by Telegram",
    home_body:
      "Onboard your venue with Google Places, let Claude draft riddles, then run live events for groups in your city. Players chat with Der Bote on Telegram while they move between stops.",
    home_cta_signin: "Sign up / Sign in",
    home_cta_admin: "Super admin",

    login_title: "Sign in",
    login_subtitle: "We will email you a magic link. No password.",
    login_placeholder_email: "you@example.com",
    login_error_auth: "Sign-in failed. Try again.",
    login_error_profile:
      "Could not set up your profile. Contact support.",
    login_success_email: "Check your email for the sign-in link.",
    login_error_generic: "Something went wrong.",
    login_btn_submit: "Email me a link",
    login_back_home: "Back to home",

    dash_brand: "Schnuffis — your bars",
    dash_nav_overview: "Overview",
    dash_nav_bars: "My bars",
    dash_nav_riddles: "My riddles",
    dash_nav_events: "Events",
    dash_nav_live: "Live view",
    dash_nav_message: "Send message",
    dash_nav_onboarding: "Add bar",
    dash_logout: "Log out",

    dash_over_title: "Overview",
    dash_over_err: "Could not load overview.",
    dash_over_bars: "Your bars",
    dash_over_manage: "Manage →",
    dash_over_active_event: "Active event",
    dash_over_events_link: "Events →",
    dash_over_live_groups: "Live groups (your active event)",
    dash_over_live_link: "Live view →",
    dash_over_onboard_prompt: "Need another venue?",
    dash_over_onboard_link: "Run onboarding",

    dash_bars_title: "My bars",
    dash_bars_add_title: "Add bar",
    dash_bars_name_ph: "Name",
    dash_bars_address_ph: "Address",
    dash_bars_prize_ph: "Prize / notes",
    dash_bars_add_btn: "Add",
    dash_bars_fail_create: "Failed to create",
    dash_bars_active: "active",
    dash_bars_inactive: "inactive",
    dash_bars_toggle: "Toggle active",
    dash_bars_delete: "Delete",
    dash_bars_confirm_delete: "Delete bar and its riddles?",

    dash_riddles_title: "My riddles",
    dash_riddles_intro:
      "Pick a bar, then add or review riddles. Difficulty 1–3 maps to easy → hard.",
    dash_riddles_bar_label: "Bar",
    dash_riddles_add_title: "Add riddle",
    dash_riddles_q_ph: "Question",
    dash_riddles_kw_ph: "Keywords, comma-separated",
    dash_riddles_diff_label: "Difficulty",
    dash_riddles_diff_1: "1 — easy",
    dash_riddles_diff_2: "2 — medium",
    dash_riddles_diff_3: "3 — hard",
    dash_riddles_hint1_ph: "Hint 1",
    dash_riddles_hint2_ph: "Hint 2",
    dash_riddles_add_btn: "Add",
    dash_riddles_kw_label: "Keywords:",
    dash_riddles_delete: "Delete",
    dash_riddles_confirm_delete: "Delete riddle?",
    dash_riddles_list_meta: "{bar} · difficulty {n}",

    dash_events_title: "Events",
    dash_events_intro:
      "Only one event can be active globally at a time. Route uses your active bars; set order for the hunt.",
    dash_events_create_title: "Create event",
    dash_events_name_ph: "Name",
    dash_events_route_label: "Route (your active bars)",
    dash_events_create_btn: "Create (inactive)",
    dash_events_active: "active",
    dash_events_set_active: "Set active",
    dash_events_deactivate: "Deactivate",
    dash_events_delete: "Delete",
    dash_events_confirm_delete: "Delete event?",
    dash_events_up: "up",
    dash_events_down: "down",
    dash_events_remove: "remove",
    dash_events_invite_emails_label: "Invite co-owners (email, one per line)",
    dash_events_invite_emails_ph: "name@bar.com",
    dash_events_co_bars_label: "Their bar IDs (UUID, comma-separated, optional)",
    dash_events_co_bars_ph: "uuid-1, uuid-2",
    dash_events_invited_list: "Invited",

    dash_live_title: "Live groups",
    dash_live_intro:
      "Groups playing your events. Refreshes on an interval and when groups change (realtime when enabled in Supabase).",
    dash_live_err: "Failed to load",
    dash_live_empty: "No groups in your events yet.",
    dash_live_th_group: "Group",
    dash_live_th_chat: "Chat ID",
    dash_live_th_event: "Event",
    dash_live_th_state: "State",
    dash_live_th_bar: "Bar",
    dash_live_th_pts: "Pts",
    dash_live_th_lang: "Lang",

    dash_msg_title: "Send message",
    dash_msg_intro:
      "Message a Telegram group that is playing one of your events (use their chat ID).",
    dash_msg_chat_ph: "Telegram chat ID",
    dash_msg_text_ph: "Message",
    dash_msg_sent: "Sent.",
    dash_msg_fail: "Failed to send",
    dash_msg_send: "Send",

    ob_title: "Add your bar",
    ob_dashboard_link: "Dashboard",
    ob_step: "Step {step} of 3 — {label}",
    ob_step1_label: "Find your bar",
    ob_step2_label: "Tell us more",
    ob_step3_label: "Riddles",
    ob_q1_label: "Paste your Google Maps link or search your bar name",
    ob_q1_ph: "Maps link or bar name",
    ob_lookup: "Look up",
    ob_pick_match: "Pick a match:",
    ob_preview: "Preview",
    ob_label_name: "Name",
    ob_label_address: "Address",
    ob_label_desc: "Description",
    ob_label_website: "Website",
    ob_label_phone: "Phone",
    ob_categories: "Categories:",
    ob_hours: "Hours",
    ob_price_level: "Price level: {n} (0–4)",
    ob_continue: "Continue",
    ob_q_special: "What makes your bar special?",
    ob_q_story: "Is there a story behind the name or location?",
    ob_q_regulars: "What do regulars always order?",
    ob_q_insider: "What would an insider know that a tourist wouldn’t?",
    ob_generate: "Generate riddles",
    ob_diff_easy: "Easy",
    ob_diff_medium: "Medium",
    ob_diff_hard: "Hard",
    ob_regenerate: "Regenerate",
    ob_label_question: "Question",
    ob_label_keywords: "Answer keywords (comma-separated)",
    ob_label_hint1: "Hint 1",
    ob_label_hint2: "Hint 2",
    ob_save: "Looks good — save bar",
    ob_saving: "Saving…",

    ob_err_search: "Search failed",
    ob_err_network: "Network error",
    ob_err_place: "Failed to load place",
    ob_err_generate: "Generation failed",
    ob_err_regen: "Regenerate failed",
    ob_err_save: "Save failed",
  },
} as const;

export type MessageKey = keyof (typeof UI)["de"];

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  let s = UI[locale][key] as string;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export const QA_CHIPS: Record<
  Locale,
  Record<OnboardingQaKey, string[]>
> = {
  de: {
    special: [
      "Live-Jazz donnerstags",
      "Bester Old Fashioned im Quartier",
      "Kleine Terrasse hinten",
    ],
    story: [
      "Benannt nach dem Hund des Wirts",
      "Ehemalige Apotheke",
      "Drei Generationen dieselbe Familie",
    ],
    regulars: [
      "Hausrot und Käseteller",
      "Was auf der Tafel steht",
      "Kirsch vor Mitternacht",
    ],
    insider: [
      "Bei der Klingel ohne Schild klingeln",
      "Ecktisch oben fragen",
      "Ab 11 nur noch bar",
    ],
  },
  en: {
    special: [
      "Live jazz on Thursdays",
      "Best Old Fashioned in the neighborhood",
      "Tiny terrace out back",
    ],
    story: [
      "Named after the landlord’s dog",
      "A former apothecary",
      "Same family for three generations",
    ],
    regulars: [
      "The house red and a plate of cheese",
      "Whatever is on the blackboard",
      "Shot of kirsch before midnight",
    ],
    insider: [
      "Ring the unmarked bell",
      "Ask for the corner table upstairs",
      "They only take cash after 11",
    ],
  },
};
