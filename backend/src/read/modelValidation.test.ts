import { describe, expect, it } from 'bun:test';
import { computeModelValidation } from './modelValidation.ts';
import type { CatalogEntry } from './entityCatalog.ts';
import type { RelationEdgeDoc } from './relationsGraph.ts';
import type { ScenarioDoc } from './scenarios.ts';

/**
 * Unit tests for the pure completeness analysis (A2) — advisory findings only.
 * A complete mini-model produces zero findings; each broken link produces its
 * finding; archived entities don't count as sources.
 */
const M = 'm-budget';

const entry = (
  id: string,
  entityType: CatalogEntry['entityType'],
  name: string,
  fields: { fieldName: string; fieldType: string }[] = [],
  archived = false,
): CatalogEntry => ({
  _id: id,
  modelId: M,
  entityType,
  name,
  definition: { fields },
  archived,
});

const edge = (id: string, fromId: string, toId: string, kind: string): RelationEdgeDoc => ({
  _id: id,
  modelId: M,
  fromId,
  toId,
  kind,
});

const completeModel = () => ({
  entries: [
    entry('w1', 'wireframe', 'Entry Form'),
    entry('c1', 'command', 'Record Line', [{ fieldName: 'amount', fieldType: 'money' }]),
    entry('f1', 'businessFact', 'Line Recorded', [
      { fieldName: 'amount', fieldType: 'money' },
    ]),
    entry('r1', 'readModel', 'Budget Lines', [{ fieldName: 'amount', fieldType: 'money' }]),
  ],
  edges: [
    edge('e1', 'w1', 'c1', 'issues'),
    edge('e2', 'c1', 'f1', 'produces'),
    edge('e3', 'f1', 'r1', 'feeds'),
  ],
  scenarios: [] as ScenarioDoc[],
});

describe('computeModelValidation', () => {
  it('finds nothing in a complete loop', () => {
    expect(computeModelValidation(completeModel())).toEqual([]);
  });

  it('flags a fact without a producing command', () => {
    const input = completeModel();
    input.edges = input.edges.filter((e) => e.kind !== 'produces');
    const findings = computeModelValidation(input);
    expect(findings.map((f) => f.kind)).toContain('fact-without-producer');
  });

  it('flags a command without any trigger', () => {
    const input = completeModel();
    input.edges = input.edges.filter((e) => e.kind !== 'issues');
    const findings = computeModelValidation(input);
    expect(findings.map((f) => f.kind)).toContain('command-without-trigger');
  });

  it('flags a read model without a feeding fact', () => {
    const input = completeModel();
    input.edges = input.edges.filter((e) => e.kind !== 'feeds');
    const findings = computeModelValidation(input);
    expect(findings.map((f) => f.kind)).toContain('readmodel-without-source');
  });

  it('flags a read-model field that no feeding fact carries (name-presence, O4)', () => {
    const input = completeModel();
    input.entries = input.entries.map((e) =>
      e._id === 'r1'
        ? {
            ...e,
            definition: {
              fields: [
                { fieldName: 'amount', fieldType: 'money' },
                { fieldName: 'phantomTotal', fieldType: 'money' },
              ],
            },
          }
        : e,
    );
    const findings = computeModelValidation(input);
    const fieldFindings = findings.filter((f) => f.kind === 'field-without-source');
    expect(fieldFindings).toHaveLength(1);
    expect(fieldFindings[0]?.missingSource).toContain('phantomTotal');
  });

  it('treats an archived producer as missing (G-C3 semantics)', () => {
    const input = completeModel();
    input.entries = input.entries.map((e) =>
      e._id === 'c1' ? { ...e, archived: true } : e,
    );
    const findings = computeModelValidation(input);
    expect(findings.map((f) => f.kind)).toContain('fact-without-producer');
  });

  it('accepts directTranslation as a read-model source (4th pattern)', () => {
    const findings = computeModelValidation({
      entries: [
        entry('x1', 'externalBusinessFact', 'Bank Statement Received', [
          { fieldName: 'total', fieldType: 'money' },
        ]),
        entry('r1', 'readModel', 'Statements', [{ fieldName: 'total', fieldType: 'money' }]),
      ],
      edges: [edge('e1', 'x1', 'r1', 'directTranslation')],
      scenarios: [],
    });
    expect(findings.filter((f) => f.entityId === 'r1')).toEqual([]);
  });

  it('flags a scenario referencing a missing entity (out-of-sync)', () => {
    const input = completeModel();
    input.scenarios = [
      {
        _id: 'sc1',
        modelId: M,
        kind: 'GWT',
        anchorId: 'c1',
        given: [{ factId: 'ghost' }],
        when: {},
        then: { reject: {} },
        referencedEntityIds: ['c1', 'ghost'],
        archived: false,
      },
    ];
    const findings = computeModelValidation(input);
    const sync = findings.filter((f) => f.kind === 'scenario-out-of-sync');
    expect(sync).toHaveLength(1);
    expect(sync[0]?.missingSource).toContain('ghost');
  });
});
