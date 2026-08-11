export const booksMigration = {
  id: '005-books',
  sql: `
    CREATE TABLE books (
      id uuid PRIMARY KEY,
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
      subtitle text NOT NULL DEFAULT '' CHECK (char_length(subtitle) <= 200),
      original_title text NOT NULL DEFAULT '' CHECK (char_length(original_title) <= 200),
      author text NOT NULL DEFAULT '' CHECK (char_length(author) <= 200),
      translator text NOT NULL DEFAULT '' CHECK (char_length(translator) <= 200),
      isbn text NOT NULL DEFAULT '' CHECK (char_length(isbn) <= 40),
      publisher text NOT NULL DEFAULT '' CHECK (char_length(publisher) <= 200),
      publish_date date,
      edition text NOT NULL DEFAULT '' CHECK (char_length(edition) <= 100),
      series text NOT NULL DEFAULT '' CHECK (char_length(series) <= 200),
      language text NOT NULL DEFAULT '' CHECK (char_length(language) <= 60),
      format text NOT NULL DEFAULT '' CHECK (char_length(format) <= 60),
      page_count integer NOT NULL DEFAULT 0 CHECK (page_count BETWEEN 0 AND 1000000),
      description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000),
      notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 20000),
      reading_status text NOT NULL DEFAULT 'to-read'
        CHECK (reading_status IN ('to-read', 'reading', 'read', 'abandoned')),
      started_at date,
      finished_at date,
      cover_file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE book_chapters (
      id uuid PRIMARY KEY,
      book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
      start_page integer NOT NULL CHECK (start_page BETWEEN 1 AND 1000000),
      end_page integer NOT NULL CHECK (end_page BETWEEN start_page AND 1000000),
      current_page integer NOT NULL CHECK (current_page BETWEEN start_page - 1 AND end_page),
      notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 10000),
      position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE INDEX books_updated_idx ON books (archived, updated_at DESC);
    CREATE INDEX books_reading_status_idx ON books (reading_status, updated_at DESC)
      WHERE archived = false;
    CREATE INDEX book_chapters_book_position_idx ON book_chapters (book_id, position, start_page);
  `,
} as const;
