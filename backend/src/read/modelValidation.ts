import type { CatalogEntry } from './entityCatalog.ts';
import type { RelationEdgeDoc } from './relationsGraph.ts';
import type { ScenarioDoc } from './scenarios.ts';
import { normalizeName } from '../shared/naming.ts';
import type { RelationKind } from '../shared/relationKind.ts';

/**
 * A2/A3 — the on-demand completeness analysis (information-completeness check,
 * em-commands). PURE compute over the read models; produces ADVISORY findings
 * only and NEVER gates a command (G-C10). Field types are free-form (O4), so
 * field checks are NAME-PRESENCE level, not type matching.
 *
 * Every check is a single hop over the relations graph (who produces/feeds/
 * issues what) — no recursive traversal, so the graph's cycles (feedback loops
 * are legal and common) cannot loop the analysis. Anything recursive added
 * later (A5 "show where used" chains) must carry a visited-set.
 */
export type ValidationFinding = {
  /** The entity the gap sits on. */
  entityId: string;
  entityName: string;
  kind:
    | 'fact-without-producer'
    | 'command-without-trigger'
    | 'readmodel-without-source'
    | 'field-without-source'
    | 'scenario-out-of-sync';
  missingSource: string;
};

export type ValidationInput = {
  entries: CatalogEntry[];
  edges: RelationEdgeDoc[];
  scenarios: ScenarioDoc[];
};

// Compiler-checked against the RelationKind union — a typo here won't build.
const COMMAND_TRIGGER_KINDS: RelationKind[] = ['issues', 'reacts', 'triggers'];
const READMODEL_SOURCE_KINDS: RelationKind[] = ['feeds', 'directTranslation'];

const fieldsOf = (entry: CatalogEntry): string[] =>
  entry.definition && 'fields' in entry.definition
    ? entry.definition.fields.map((f) => f.fieldName)
    : [];

export const computeModelValidation = ({
  entries,
  edges,
  scenarios,
}: ValidationInput): ValidationFinding[] => {
  const active = entries.filter((e) => !e.archived);
  const activeIds = new Set(active.map((e) => e._id));
  const byId = new Map(active.map((e) => [e._id, e]));
  const liveEdges = edges.filter(
    (e) => activeIds.has(e.fromId) && activeIds.has(e.toId),
  );
  const incoming = new Map<string, RelationEdgeDoc[]>();
  for (const edge of liveEdges) {
    const list = incoming.get(edge.toId) ?? [];
    list.push(edge);
    incoming.set(edge.toId, list);
  }

  const findings: ValidationFinding[] = [];

  for (const entry of active) {
    const inbound = incoming.get(entry._id) ?? [];
    switch (entry.entityType) {
      case 'businessFact': {
        // A fact must come from somewhere: a producing command, or an inbound
        // translation chain feeding the model (G-C9 exempts Define* itself —
        // this is about the MODELED flow, not the modeling tool).
        if (!inbound.some((e) => e.kind === 'produces'))
          findings.push({
            entityId: entry._id,
            entityName: entry.name,
            kind: 'fact-without-producer',
            missingSource: 'no command produces this fact',
          });
        break;
      }
      case 'command': {
        if (!inbound.some((e) => (COMMAND_TRIGGER_KINDS as string[]).includes(e.kind)))
          findings.push({
            entityId: entry._id,
            entityName: entry.name,
            kind: 'command-without-trigger',
            missingSource:
              'no wireframe issues, automation reacts to, or translation triggers this command',
          });
        break;
      }
      case 'readModel': {
        const feeders = inbound.filter((e) =>
          (READMODEL_SOURCE_KINDS as string[]).includes(e.kind),
        );
        if (feeders.length === 0) {
          findings.push({
            entityId: entry._id,
            entityName: entry.name,
            kind: 'readmodel-without-source',
            missingSource: 'no fact feeds this read model',
          });
          break;
        }
        // Field presence: every read-model field name should appear on at
        // least one feeding fact (normalized compare; free-form types — O4).
        const available = new Set(
          feeders.flatMap((e) => {
            const source = byId.get(e.fromId);
            return source ? fieldsOf(source).map(normalizeName) : [];
          }),
        );
        for (const fieldName of fieldsOf(entry))
          if (!available.has(normalizeName(fieldName)))
            findings.push({
              entityId: entry._id,
              entityName: entry.name,
              kind: 'field-without-source',
              missingSource: `field '${fieldName}' appears on no feeding fact`,
            });
        break;
      }
      default:
        break;
    }
  }

  // GWT/GT sync: every referenced entity must still exist and be active
  // (same rule the scenario GET derives as `outOfSync`).
  for (const scenario of scenarios.filter((s) => !s.archived)) {
    const dangling = scenario.referencedEntityIds.filter((id) => !activeIds.has(id));
    if (dangling.length > 0)
      findings.push({
        entityId: scenario._id,
        entityName: `scenario ${scenario._id}`,
        kind: 'scenario-out-of-sync',
        missingSource: `references missing/archived entities: ${dangling.join(', ')}`,
      });
  }

  return findings;
};
