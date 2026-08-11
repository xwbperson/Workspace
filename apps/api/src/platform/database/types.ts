import type { QueryResult, QueryResultRow } from 'pg';

export interface DatabaseClient {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
  release(): void;
}

export interface Database {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
  connect(): Promise<DatabaseClient>;
  end(): Promise<void>;
}
