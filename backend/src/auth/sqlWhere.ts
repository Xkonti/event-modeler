/**
 * Translates the small subset of better-auth `where` shapes our plain-CRUD
 * stores (`auth_session`, `auth_verification`) receive into parameterized SQL.
 *
 * better-auth hands `CleanedWhere[]` (operator/value/field/connector all set).
 * We support `eq`/`ne`/`in`/`not_in` joined by AND/OR — the only shapes the
 * session/verification flow issues. Anything else throws `Unsupported where`
 * (fail loud: a silent miss is an auth bug). PII/ES models never reach here.
 *
 * Pure (no DB) and Node-safe. Column mapping is injected so each store owns its
 * own field→column map.
 */
export type AdapterWhere = {
  field: string;
  value: string | number | boolean | string[] | number[] | Date | null;
  operator?: string;
  connector?: 'AND' | 'OR';
};

export type WhereSQL = { clause: string; values: unknown[] };

/**
 * Refuse an unconstrained mutation. An empty `where` builds an empty clause →
 * `DELETE`/`UPDATE` with no `WHERE` would hit EVERY row (mass logout / data
 * loss). Callers that mutate must gate on this; reads/counts may pass empty.
 */
export const assertConstrained = (
  where: AdapterWhere[] | undefined,
  op: string,
): void => {
  if (!where || where.length === 0)
    throw new Error(`Refusing unconstrained ${op}: empty where would affect all rows.`);
};

/**
 * Build a `WHERE …` clause + ordered values from adapter where-clauses.
 *
 * @param toColumn  field name → SQL column (throws on unknown field).
 * @param startIndex 0-based offset for the first placeholder (so UPDATE can put
 *                   its SET values first). Placeholders are `$N` (1-based).
 */
export const buildWhere = (
  where: AdapterWhere[],
  toColumn: (field: string) => string,
  startIndex = 0,
): WhereSQL => {
  if (where.length === 0) return { clause: '', values: [] };

  const values: unknown[] = [];
  let p = startIndex;
  const parts: string[] = [];
  const connectors: ('AND' | 'OR')[] = [];

  for (let i = 0; i < where.length; i++) {
    const w = where[i]!;
    const column = toColumn(w.field);
    const op = w.operator ?? 'eq';
    if (i > 0) connectors.push(w.connector ?? 'AND');

    switch (op) {
      case 'eq':
        if (w.value === null) {
          parts.push(`${column} IS NULL`);
        } else {
          p += 1;
          values.push(w.value);
          parts.push(`${column} = $${p}`);
        }
        break;
      case 'ne':
        if (w.value === null) {
          parts.push(`${column} IS NOT NULL`);
        } else {
          p += 1;
          values.push(w.value);
          parts.push(`${column} <> $${p}`);
        }
        break;
      case 'in':
        p += 1;
        values.push(w.value);
        parts.push(`${column} = ANY($${p})`);
        break;
      case 'not_in':
        p += 1;
        values.push(w.value);
        parts.push(`NOT (${column} = ANY($${p}))`);
        break;
      default:
        throw new Error(`Unsupported where operator '${op}' on field '${w.field}'`);
    }
  }

  // better-auth uses a single connector for the whole clause in practice; join
  // left-to-right with each clause's declared connector (default AND).
  let clause = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    clause += ` ${connectors[i - 1]} ${parts[i]}`;
  }
  return { clause: `WHERE ${clause}`, values };
};
