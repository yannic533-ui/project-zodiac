-- Enums
CREATE TYPE group_state AS ENUM ('waiting', 'riddle', 'travelling', 'finished');
CREATE TYPE group_language AS ENUM ('de', 'en');

-- Bars
CREATE TABLE bars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  prize_description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Riddles
CREATE TABLE riddles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES bars (id) ON DELETE CASCADE,
  question text NOT NULL,
  answer_keywords text[] NOT NULL DEFAULT '{}',
  difficulty smallint NOT NULL CHECK (difficulty >= 1 AND difficulty <= 3),
  hint_1 text NOT NULL DEFAULT '',
  hint_2 text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX riddles_bar_id_idx ON riddles (bar_id);

-- Events
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date timestamptz,
  route uuid[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active event at a time (optional constraint per plan)
CREATE UNIQUE INDEX events_single_active_idx ON events ((active)) WHERE active = true;

-- Groups (playing teams in Telegram)
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL UNIQUE,
  group_name text NOT NULL DEFAULT '',
  current_bar_index int NOT NULL DEFAULT 0,
  points int NOT NULL DEFAULT 0,
  state group_state NOT NULL DEFAULT 'waiting',
  hint_count int NOT NULL DEFAULT 0,
  hints_delivered int NOT NULL DEFAULT 0 CHECK (hints_delivered >= 0 AND hints_delivered <= 2),
  language group_language,
  started_at timestamptz,
  last_progress_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX groups_telegram_chat_id_idx ON groups (telegram_chat_id);
CREATE INDEX groups_event_id_idx ON groups (event_id);

-- Passphrases log
CREATE TABLE passphrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES bars (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  code text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX passphrases_event_id_idx ON passphrases (event_id);

-- RLS: deny anon/authenticated; service role bypasses
ALTER TABLE bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE riddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE passphrases ENABLE ROW LEVEL SECURITY;
