export const timetableMigration = {
  id: '016-timetable',
  sql: `
    CREATE TABLE timetable_semesters (
      id uuid PRIMARY KEY,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
      short_name text NOT NULL CHECK (char_length(short_name) BETWEEN 1 AND 40),
      first_week_monday date NOT NULL,
      total_weeks integer NOT NULL CHECK (total_weeks BETWEEN 1 AND 30),
      is_current boolean NOT NULL DEFAULT false,
      show_weekend boolean NOT NULL DEFAULT true,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE timetable_time_blocks (
      id uuid PRIMARY KEY,
      semester_id uuid NOT NULL REFERENCES timetable_semesters(id) ON DELETE CASCADE,
      label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 20),
      source_label text NOT NULL DEFAULT '' CHECK (char_length(source_label) <= 40),
      start_time time NOT NULL,
      end_time time NOT NULL,
      position integer NOT NULL CHECK (position BETWEEN 1 AND 5),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      UNIQUE (semester_id, label),
      UNIQUE (semester_id, position),
      CHECK (end_time > start_time)
    );

    CREATE TABLE timetable_courses (
      id uuid PRIMARY KEY,
      semester_id uuid NOT NULL REFERENCES timetable_semesters(id) ON DELETE CASCADE,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
      short_name text NOT NULL DEFAULT '' CHECK (char_length(short_name) <= 30),
      instructors jsonb NOT NULL DEFAULT '[]'::jsonb,
      color text NOT NULL DEFAULT 'teal' CHECK (color IN ('teal','blue','violet','amber','rose','slate')),
      notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE timetable_meetings (
      id uuid PRIMARY KEY,
      course_id uuid NOT NULL REFERENCES timetable_courses(id) ON DELETE CASCADE,
      time_block_id uuid NOT NULL REFERENCES timetable_time_blocks(id),
      weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7),
      room text NOT NULL DEFAULT '' CHECK (char_length(room) <= 120),
      instructor_override jsonb NOT NULL DEFAULT '[]'::jsonb,
      position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      UNIQUE (course_id, position)
    );

    CREATE TABLE timetable_meeting_weeks (
      meeting_id uuid NOT NULL REFERENCES timetable_meetings(id) ON DELETE CASCADE,
      week_number integer NOT NULL CHECK (week_number BETWEEN 1 AND 30),
      PRIMARY KEY (meeting_id, week_number)
    );

    CREATE TABLE timetable_adjustments (
      id uuid PRIMARY KEY,
      course_id uuid NOT NULL REFERENCES timetable_courses(id) ON DELETE CASCADE,
      meeting_id uuid NOT NULL REFERENCES timetable_meetings(id) ON DELETE CASCADE,
      original_date date NOT NULL,
      type text NOT NULL CHECK (type IN ('cancel', 'reschedule', 'override')),
      new_date date,
      new_time_block_id uuid REFERENCES timetable_time_blocks(id),
      room text CHECK (room IS NULL OR char_length(room) <= 120),
      instructors jsonb,
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      UNIQUE (meeting_id, original_date),
      CHECK (
        (type = 'cancel' AND new_date IS NULL AND new_time_block_id IS NULL)
        OR (type = 'reschedule' AND new_date IS NOT NULL AND new_time_block_id IS NOT NULL)
        OR type = 'override'
      )
    );

    CREATE INDEX timetable_semesters_status_idx
      ON timetable_semesters (status, is_current DESC, first_week_monday DESC);
    CREATE INDEX timetable_courses_semester_idx
      ON timetable_courses (semester_id, status, updated_at DESC);
    CREATE INDEX timetable_meetings_course_idx ON timetable_meetings (course_id, position);
    CREATE INDEX timetable_adjustments_date_idx
      ON timetable_adjustments (original_date, new_date, course_id);
  `,
} as const;
