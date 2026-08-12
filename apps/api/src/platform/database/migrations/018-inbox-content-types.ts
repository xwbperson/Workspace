export const inboxContentTypesMigration = {
  id: '018-inbox-content-types',
  sql: `
    ALTER TABLE inbox_items
      ADD COLUMN content_type text;

    UPDATE inbox_items SET content_type=type;

    ALTER TABLE inbox_items
      ALTER COLUMN content_type SET NOT NULL,
      ADD CONSTRAINT inbox_items_content_type_check
      CHECK (content_type IN (
        'idea', 'inspiration', 'snippet', 'article', 'link', 'file', 'information', 'other'
      ));
  `,
} as const;
