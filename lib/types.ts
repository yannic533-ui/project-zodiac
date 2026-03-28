export type GroupState = "waiting" | "riddle" | "travelling" | "finished";
export type GroupLanguage = "de" | "en";

export type BarRow = {
  id: string;
  name: string;
  address: string;
  active: boolean;
  prize_description: string;
  created_at: string;
};

export type RiddleRow = {
  id: string;
  bar_id: string;
  question: string;
  answer_keywords: string[];
  difficulty: number;
  hint_1: string;
  hint_2: string;
  created_at: string;
};

export type EventRow = {
  id: string;
  name: string;
  date: string | null;
  route: string[];
  active: boolean;
  created_at: string;
};

export type GroupRow = {
  id: string;
  event_id: string;
  telegram_chat_id: string;
  group_name: string;
  current_bar_index: number;
  points: number;
  state: GroupState;
  hint_count: number;
  hints_delivered: number;
  language: GroupLanguage | null;
  started_at: string | null;
  last_progress_at: string | null;
  created_at: string;
};
