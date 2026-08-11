export const coursesMigration = {
  id: '006-courses',
  sql: `
    CREATE TABLE courses (
      id uuid PRIMARY KEY,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
      instructor text NOT NULL DEFAULT '' CHECK (char_length(instructor) <= 200),
      course_code text NOT NULL DEFAULT '' CHECK (char_length(course_code) <= 80),
      credits numeric(5,2) NOT NULL DEFAULT 0 CHECK (credits BETWEEN 0 AND 100),
      total_hours integer NOT NULL DEFAULT 0 CHECK (total_hours BETWEEN 0 AND 10000),
      objectives text NOT NULL DEFAULT '' CHECK (char_length(objectives) <= 20000),
      description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 20000),
      schedule text NOT NULL DEFAULT '' CHECK (char_length(schedule) <= 5000),
      syllabus_file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE course_reference_books (
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
      created_at timestamptz NOT NULL,
      PRIMARY KEY (course_id, book_id)
    );

    CREATE TABLE course_class_records (
      id uuid PRIMARY KEY,
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      occurred_at timestamptz NOT NULL,
      content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE course_assignments (
      id uuid PRIMARY KEY,
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
      description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 20000),
      due_at timestamptz,
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in-progress', 'completed', 'abandoned')),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE course_material_groups (
      id uuid PRIMARY KEY,
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
      position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE course_materials (
      id uuid PRIMARY KEY,
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      group_id uuid REFERENCES course_material_groups(id) ON DELETE SET NULL,
      file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
      label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 240),
      position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE INDEX courses_updated_idx ON courses (archived, updated_at DESC);
    CREATE INDEX course_reference_books_course_idx ON course_reference_books (course_id, position);
    CREATE INDEX course_class_records_course_idx ON course_class_records (course_id, occurred_at DESC);
    CREATE INDEX course_assignments_course_idx ON course_assignments (course_id, status, due_at);
    CREATE INDEX course_material_groups_course_idx ON course_material_groups (course_id, position);
    CREATE INDEX course_materials_course_idx ON course_materials (course_id, group_id, position);
  `,
} as const;
