// Minimal stand-in for the supabase-js query builder used by action tests.
// Every from(...) chain is recorded as one op and answered by the test's `respond`.

export type FakeResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

export type FakeOp = {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  row?: Record<string, unknown>;
  filters: Record<string, unknown>;
  /** true when .select() was chained after a write (rows are returned). */
  returning: boolean;
};

interface FakeBuilder extends PromiseLike<FakeResult> {
  insert(row: Record<string, unknown>): FakeBuilder;
  update(row: Record<string, unknown>): FakeBuilder;
  delete(): FakeBuilder;
  select(columns?: string): FakeBuilder;
  eq(column: string, value: unknown): FakeBuilder;
  in(column: string, values: unknown[]): FakeBuilder;
  order(column: string, options?: unknown): FakeBuilder;
  single(): Promise<FakeResult>;
  maybeSingle(): Promise<FakeResult>;
}

export function createFakeClient(respond: (op: FakeOp) => FakeResult = () => ({ data: null, error: null })) {
  const ops: FakeOp[] = [];
  const client = {
    from(table: string): FakeBuilder {
      const op: FakeOp = { table, action: "select", filters: {}, returning: false };
      ops.push(op);
      const run = () => Promise.resolve(respond(op));
      const builder: FakeBuilder = {
        insert(row) {
          op.action = "insert";
          op.row = row;
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
        select() {
          if (op.action !== "select") op.returning = true;
          return builder;
        },
        eq(column, value) {
          op.filters[column] = value;
          return builder;
        },
        in(column, values) {
          op.filters[column] = values;
          return builder;
        },
        order() {
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
