declare module "sql.js" {
  export interface Statement {
    bind(values?: Array<string | number | null>): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    run(values?: Array<string | number | null>): void;
    free(): void;
  }

  export interface Database {
    prepare(sql: string): Statement;
    run(sql: string, values?: Array<string | number | null>): void;
    export(): Uint8Array;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  const initSqlJs: (config?: {
    locateFile?: (file: string) => string;
  }) => Promise<SqlJsStatic>;

  export default initSqlJs;
}