// Minimal stand-in for the supabase-js query builder used by action tests.
// Every from(...) chain is recorded as one op and answered by the test's `respond`.

export type FakeResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
};

export type FakeOp = {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  row?: Record<string, unknown>;
  /** Set instead of `row` when insert() received an array. */
  rows?: Record<string, unknown>[];
  /** Column list passed to select(), e.g. "id, playlists(title)". */
  columns?: string;
  /**
   * eq/in filters keyed by column. Other operators are keyed as "op:column"
   * (is:team_id, neq:playlist_id) and or() filters as "or".
   */
  filters: Record<string, unknown>;
  orders: { column: string; ascending: boolean }[];
  limit?: number;
  /** true when .select() was chained after a write (rows are returned). */
  returning: boolean;
};

interface FakeBuilder extends PromiseLike<FakeResult> {
  insert(row: Record<string, unknown> | Record<string, unknown>[]): FakeBuilder;
  update(row: Record<string, unknown>): FakeBuilder;
  delete(): FakeBuilder;
  select(columns?: string, options?: unknown): FakeBuilder;
  eq(column: string, value: unknown): FakeBuilder;
  neq(column: string, value: unknown): FakeBuilder;
  is(column: string, value: unknown): FakeBuilder;
  in(column: string, values: unknown[]): FakeBuilder;
  or(filters: string): FakeBuilder;
  order(column: string, options?: { ascending?: boolean }): FakeBuilder;
  limit(count: number): FakeBuilder;
  single(): Promise<FakeResult>;
  maybeSingle(): Promise<FakeResult>;
}

export function createFakeClient(respond: (op: FakeOp) => FakeResult = () => ({ data: null, error: null })) {
  const ops: FakeOp[] = [];
  const client = {
    from(table: string): FakeBuilder {
      const op: FakeOp = { table, action: "select", filters: {}, orders: [], returning: false };
      ops.push(op);
      const run = () => Promise.resolve(respond(op));
      const builder: FakeBuilder = {
        insert(row) {
          op.action = "insert";
          if (Array.isArray(row)) op.rows = row;
          else op.row = row;
          return builder;
        },
        update(row) {
          op.action = "update";
          op.row = row;
          return builder;
        },
        delete() {
          op.action = "delete";
          return builder;
        },
        select(columns) {
          if (op.action !== "select") op.returning = true;
          else op.columns = columns;
          return builder;
        },
        eq(column, value) {
          op.filters[column] = value;
          return builder;
        },
        neq(column, value) {
          op.filters[`neq:${column}`] = value;
          return builder;
        },
        is(column, value) {
          op.filters[`is:${column}`] = value;
          return builder;
        },
        in(column, values) {
          op.filters[column] = values;
          return builder;
        },
        or(filters) {
          op.filters.or = filters;
          return builder;
        },
        order(column, options) {
          op.orders.push({ column, ascending: options?.ascending ?? true });
          return builder;
        },
        limit(count) {
          op.limit = count;
          return builder;
        },
        single: run,
        maybeSingle: run,
        then(onfulfilled, onrejected) {
          return run().then(onfulfilled, onrejected);
        },
      };
      return builder;
    },
  };
  return { client, ops };
}
