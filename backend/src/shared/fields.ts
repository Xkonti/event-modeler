/**
 * A single field on a catalog entity's definition (decision #1/#7). Shared by
 * every type that holds a `fields` schema — businessFact, command, readModel,
 * externalBusinessFact. `fieldType` is FREE-FORM text, not an enum (O4): simpler
 * in ES (no enum migration/upcasting), and the completeness check is
 * presence/semantic-based, not strict type-matching (notes/validation.md).
 *
 * `derived` (F7) marks an attribute computed from state already in the system
 * (projection-computed like `sliceCount`, decider-computed like `slotRole`)
 * rather than sourced upstream — the completeness walk (A3) skips it. Absent =
 * false; the API sanitizer drops a false flag so events stay lean.
 */
export type FieldDef = { fieldName: string; fieldType: string; derived?: boolean };

/**
 * API-edge sanitizer: coerce a raw request `fields` payload into clean
 * FieldDefs (no extra keys reach the event store; `derived` only when true).
 */
export const sanitizeFields = (raw: unknown): FieldDef[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => {
    const { fieldName, fieldType, derived } = (f ?? {}) as Record<string, unknown>;
    return {
      fieldName: typeof fieldName === 'string' ? fieldName : '',
      fieldType: typeof fieldType === 'string' ? fieldType : '',
      ...(derived === true ? { derived: true } : {}),
    };
  });
};

/** Shared decider guard: blank / whitespace-only name (G-C1). */
export const isBlank = (name: string): boolean => name.trim().length === 0;

/**
 * Shared decider guard: duplicate `fieldName` within one definition (structural
 * reject, em-scenarios Flow 1). Case-insensitive on the trimmed name.
 */
export const hasDuplicateFieldName = (fields: FieldDef[]): boolean => {
  const seen = new Set<string>();
  for (const f of fields) {
    const key = f.fieldName.trim().toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};
