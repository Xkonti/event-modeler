// Build the "EventModeler" model via the backend API — 1:1 with the implemented v1 backend.
// Usage: node /tmp/build-eventmodeler.mjs
const BASE = process.env.EM_BASE ?? 'http://localhost:5173/api';
const EMAIL = 'ben+modeler@xkonti.tech';
const PASSWORD = 'thisispassword';

let cookie = '';
const uuid = () => crypto.randomUUID();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const req = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
};

// Retry on 422 (async projection lag on cross-aggregate pre-checks) — project convention.
const reqRetry = async (method, path, body, label) => {
  for (let i = 0; i < 40; i++) {
    const r = await req(method, path, body);
    if (r.status < 400) return r;
    if (r.status !== 422 && r.status !== 404) {
      failures.push(`${label}: ${r.status} ${JSON.stringify(r.json)}`);
      return r;
    }
    await sleep(300);
  }
  failures.push(`${label}: gave up after retries (422/404)`);
  return null;
};

const login = async () => {
  const auth = (path, body) =>
    fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify(body),
    });
  let res = await auth('/auth/sign-in/email', { email: EMAIL, password: PASSWORD });
  if (!res.ok) {
    // Fresh DB (e.g. throwaway testcontainer) — register instead.
    res = await auth('/auth/sign-up/email', { email: EMAIL, password: PASSWORD, name: 'Ben' });
    if (!res.ok) throw new Error('login failed: ' + (await res.text()));
  }
  const sc = res.headers.get('set-cookie');
  cookie = sc.split(';')[0];
  console.log('logged in');
};

// ---------------------------------------------------------------------------
// DATA — the EventModeler app's own event model (implemented v1 scope)
// ---------------------------------------------------------------------------

const f = (pairs) => pairs.map(([fieldName, fieldType]) => ({ fieldName, fieldType }));
const ID = f([['modelId', 'uuid']]);
const ENT = f([['modelId', 'uuid'], ['entityId', 'uuid']]);
const ENTN = f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string']]);
const ENTF = f([['modelId', 'uuid'], ['entityId', 'uuid'], ['fields', 'FieldDef[]']]);
const DEFN = f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string'], ['fields', 'FieldDef[]']]);

const CONTEXTS = [
  'Model', 'BusinessFact', 'Command', 'ReadModel', 'Wireframe',
  'ExternalBusinessFact', 'Automation', 'Translation', 'Context',
  'Chapter', 'Slice', 'Relation', 'Scenario',
];

// C1 — the model's own chapter band (creation order = band order).
const CHAPTERS = ['Setup', 'Catalog', 'Streams', 'Assembly', 'Rules', 'Organize', 'React', 'Analyze'];

// name -> { lane, fields }
const FACTS = {
  ModelCreated: { lane: 'Model', fields: f([['modelId', 'uuid'], ['name', 'string']]) },
  ModelRenamed: { lane: 'Model', fields: f([['modelId', 'uuid'], ['name', 'string']]) },
  ModelArchived: { lane: 'Model', fields: ID },

  BusinessFactDefined: { lane: 'BusinessFact', fields: DEFN },
  BusinessFactRenamed: { lane: 'BusinessFact', fields: ENTN },
  BusinessFactFieldsUpdated: { lane: 'BusinessFact', fields: ENTF },
  BusinessFactArchived: { lane: 'BusinessFact', fields: ENT },
  BusinessFactAssignedToContext: { lane: 'BusinessFact', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['contextId', 'uuid'], ['previousContextId', 'uuid?']]) },
  BusinessFactContextCleared: { lane: 'BusinessFact', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['previousContextId', 'uuid?']]) },

  CommandDefined: { lane: 'Command', fields: DEFN },
  CommandRenamed: { lane: 'Command', fields: ENTN },
  CommandFieldsUpdated: { lane: 'Command', fields: ENTF },
  CommandArchived: { lane: 'Command', fields: ENT },

  ReadModelDefined: { lane: 'ReadModel', fields: [...DEFN, ...f([['mode', "'projected' | 'live' (F7, default projected)"]])] },
  ReadModelRenamed: { lane: 'ReadModel', fields: ENTN },
  ReadModelFieldsUpdated: { lane: 'ReadModel', fields: [...ENTF, ...f([['mode', "'projected' | 'live' (F7)"]])] },
  ReadModelArchived: { lane: 'ReadModel', fields: ENT },

  WireframeDefined: { lane: 'Wireframe', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string'], ['content', 'string']]) },
  WireframeRenamed: { lane: 'Wireframe', fields: ENTN },
  WireframeContentUpdated: { lane: 'Wireframe', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['content', 'string']]) },
  WireframeArchived: { lane: 'Wireframe', fields: ENT },

  ExternalBusinessFactDefined: { lane: 'ExternalBusinessFact', fields: DEFN },
  ExternalBusinessFactRenamed: { lane: 'ExternalBusinessFact', fields: ENTN },
  ExternalBusinessFactFieldsUpdated: { lane: 'ExternalBusinessFact', fields: ENTF },
  ExternalBusinessFactArchived: { lane: 'ExternalBusinessFact', fields: ENT },
  ExternalBusinessFactAssignedToContext: { lane: 'ExternalBusinessFact', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['contextId', 'uuid'], ['previousContextId', 'uuid?']]) },
  ExternalBusinessFactContextCleared: { lane: 'ExternalBusinessFact', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['previousContextId', 'uuid?']]) },

  AutomationDefined: { lane: 'Automation', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string'], ['triggerConfig', 'TriggerConfig']]) },
  AutomationRenamed: { lane: 'Automation', fields: ENTN },
  AutomationReconfigured: { lane: 'Automation', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['triggerConfig', 'TriggerConfig']]) },
  AutomationArchived: { lane: 'Automation', fields: ENT },

  TranslationDefined: { lane: 'Translation', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string'], ['mapping', 'Mapping']]) },
  TranslationRenamed: { lane: 'Translation', fields: ENTN },
  TranslationMappingUpdated: { lane: 'Translation', fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['mapping', 'Mapping']]) },
  TranslationArchived: { lane: 'Translation', fields: ENT },

  ContextDefined: { lane: 'Context', fields: f([['modelId', 'uuid'], ['contextId', 'uuid'], ['name', 'string']]) },
  ContextRenamed: { lane: 'Context', fields: f([['modelId', 'uuid'], ['contextId', 'uuid'], ['name', 'string']]) },
  ContextArchived: { lane: 'Context', fields: f([['modelId', 'uuid'], ['contextId', 'uuid']]) },

  ChapterDefined: { lane: 'Chapter', fields: f([['modelId', 'uuid'], ['chapterId', 'uuid'], ['name', 'string']]) },
  ChapterRenamed: { lane: 'Chapter', fields: f([['modelId', 'uuid'], ['chapterId', 'uuid'], ['name', 'string']]) },
  ChapterArchived: { lane: 'Chapter', fields: f([['modelId', 'uuid'], ['chapterId', 'uuid']]) },
  SliceAssignedToChapter: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['chapterId', 'uuid'], ['previousChapterId', 'uuid?']]) },
  SliceChapterCleared: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['previousChapterId', 'uuid?']]) },

  SliceDefined: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['name', 'string']]) },
  SliceRenamed: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['name', 'string']]) },
  SliceArchived: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid']]) },
  EntityPlaced: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['placedEntityId', 'uuid'], ['slotRole', 'trigger|command|readModel|fact (computed from type)'], ['slot', 'int (0 = top; omitted for single-cardinality bands)']]) },
  EntitySlotsSwapped: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['entityIdA', 'uuid'], ['entityIdB', 'uuid']]) },
  EntityRemovedFromSlice: { lane: 'Slice', fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['placedEntityId', 'uuid']]) },

  RelationDrawn: { lane: 'Relation', fields: f([['modelId', 'uuid'], ['relationId', 'uuid'], ['fromId', 'uuid'], ['toId', 'uuid'], ['kind', 'RelationKind (11-pair allow-list)'], ['meta', 'json?']]) },
  RelationInfoUpdated: { lane: 'Relation', fields: f([['modelId', 'uuid'], ['relationId', 'uuid'], ['kind', 'RelationKind?'], ['meta', 'json?']]) },
  RelationRemoved: { lane: 'Relation', fields: f([['modelId', 'uuid'], ['relationId', 'uuid']]) },

  ScenarioDefined: { lane: 'Scenario', fields: f([['modelId', 'uuid'], ['scenarioId', 'uuid'], ['kind', 'GWT|GT'], ['anchorId', 'uuid (soft ref)'], ['given', 'GivenStep[]'], ['when', 'WhenClause?'], ['then', 'ThenClause']]) },
  ScenarioUpdated: { lane: 'Scenario', fields: f([['modelId', 'uuid'], ['scenarioId', 'uuid'], ['kind', 'GWT|GT'], ['anchorId', 'uuid (soft ref)'], ['given', 'GivenStep[]'], ['when', 'WhenClause?'], ['then', 'ThenClause']]) },
  ScenarioArchived: { lane: 'Scenario', fields: f([['modelId', 'uuid'], ['scenarioId', 'uuid']]) },
};

// name -> { fields, produces: [fact names] }
const COMMANDS = {
  CreateModel: { fields: f([['name', 'string']]), produces: ['ModelCreated'] },
  RenameModel: { fields: f([['modelId', 'uuid'], ['name', 'string']]), produces: ['ModelRenamed'] },
  ArchiveModel: { fields: ID, produces: ['ModelArchived'] },

  DefineBusinessFact: { fields: DEFN, produces: ['BusinessFactDefined'] },
  RenameBusinessFact: { fields: ENTN, produces: ['BusinessFactRenamed'] },
  UpdateBusinessFactFields: { fields: ENTF, produces: ['BusinessFactFieldsUpdated'] },
  ArchiveBusinessFact: { fields: ENT, produces: ['BusinessFactArchived'] },
  AssignBusinessFactToContext: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['contextId', 'uuid']]), produces: ['BusinessFactAssignedToContext'] },
  ClearBusinessFactContext: { fields: ENT, produces: ['BusinessFactContextCleared'] },

  DefineCommand: { fields: DEFN, produces: ['CommandDefined'] },
  RenameCommand: { fields: ENTN, produces: ['CommandRenamed'] },
  UpdateCommandFields: { fields: ENTF, produces: ['CommandFieldsUpdated'] },
  ArchiveCommand: { fields: ENT, produces: ['CommandArchived'] },

  DefineReadModel: { fields: [...DEFN, ...f([['mode', "'projected' | 'live'? (F7)"]])], produces: ['ReadModelDefined'] },
  RenameReadModel: { fields: ENTN, produces: ['ReadModelRenamed'] },
  UpdateReadModelFields: { fields: [...ENTF, ...f([['mode', "'projected' | 'live'? (F7)"]])], produces: ['ReadModelFieldsUpdated'] },
  ArchiveReadModel: { fields: ENT, produces: ['ReadModelArchived'] },

  DefineWireframe: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string'], ['content', 'string']]), produces: ['WireframeDefined'] },
  RenameWireframe: { fields: ENTN, produces: ['WireframeRenamed'] },
  UpdateWireframeContent: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['content', 'string']]), produces: ['WireframeContentUpdated'] },
  ArchiveWireframe: { fields: ENT, produces: ['WireframeArchived'] },

  DefineExternalBusinessFact: { fields: DEFN, produces: ['ExternalBusinessFactDefined'] },
  RenameExternalBusinessFact: { fields: ENTN, produces: ['ExternalBusinessFactRenamed'] },
  UpdateExternalBusinessFactFields: { fields: ENTF, produces: ['ExternalBusinessFactFieldsUpdated'] },
  ArchiveExternalBusinessFact: { fields: ENT, produces: ['ExternalBusinessFactArchived'] },
  AssignExternalBusinessFactToContext: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['contextId', 'uuid']]), produces: ['ExternalBusinessFactAssignedToContext'] },
  ClearExternalBusinessFactContext: { fields: ENT, produces: ['ExternalBusinessFactContextCleared'] },

  DefineAutomation: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string'], ['triggerConfig', 'TriggerConfig']]), produces: ['AutomationDefined'] },
  RenameAutomation: { fields: ENTN, produces: ['AutomationRenamed'] },
  ReconfigureAutomation: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['triggerConfig', 'TriggerConfig']]), produces: ['AutomationReconfigured'] },
  ArchiveAutomation: { fields: ENT, produces: ['AutomationArchived'] },

  DefineTranslation: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['name', 'string'], ['mapping', 'Mapping']]), produces: ['TranslationDefined'] },
  RenameTranslation: { fields: ENTN, produces: ['TranslationRenamed'] },
  UpdateTranslationMapping: { fields: f([['modelId', 'uuid'], ['entityId', 'uuid'], ['mapping', 'Mapping']]), produces: ['TranslationMappingUpdated'] },
  ArchiveTranslation: { fields: ENT, produces: ['TranslationArchived'] },

  DefineContext: { fields: f([['modelId', 'uuid'], ['contextId', 'uuid'], ['name', 'string']]), produces: ['ContextDefined'] },
  RenameContext: { fields: f([['modelId', 'uuid'], ['contextId', 'uuid'], ['name', 'string']]), produces: ['ContextRenamed'] },
  ArchiveContext: { fields: f([['modelId', 'uuid'], ['contextId', 'uuid']]), produces: ['ContextArchived'] },

  DefineChapter: { fields: f([['modelId', 'uuid'], ['chapterId', 'uuid'], ['name', 'string']]), produces: ['ChapterDefined'] },
  RenameChapter: { fields: f([['modelId', 'uuid'], ['chapterId', 'uuid'], ['name', 'string']]), produces: ['ChapterRenamed'] },
  ArchiveChapter: { fields: f([['modelId', 'uuid'], ['chapterId', 'uuid']]), produces: ['ChapterArchived'] },
  AssignSliceToChapter: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['chapterId', 'uuid']]), produces: ['SliceAssignedToChapter'] },
  ClearSliceChapter: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid']]), produces: ['SliceChapterCleared'] },

  DefineSlice: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['name', 'string']]), produces: ['SliceDefined'] },
  RenameSlice: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['name', 'string']]), produces: ['SliceRenamed'] },
  ArchiveSlice: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid']]), produces: ['SliceArchived'] },
  PlaceEntity: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['placedEntityId', 'uuid']]), produces: ['EntityPlaced'] },
  SwapEntitySlots: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['entityIdA', 'uuid'], ['entityIdB', 'uuid']]), produces: ['EntitySlotsSwapped'] },
  RemoveEntityFromSlice: { fields: f([['modelId', 'uuid'], ['sliceId', 'uuid'], ['placedEntityId', 'uuid']]), produces: ['EntityRemovedFromSlice'] },

  DrawRelation: { fields: f([['modelId', 'uuid'], ['relationId', 'uuid'], ['fromId', 'uuid'], ['toId', 'uuid'], ['kind', 'RelationKind'], ['meta', 'json?']]), produces: ['RelationDrawn'] },
  UpdateRelationInfo: { fields: f([['modelId', 'uuid'], ['relationId', 'uuid'], ['kind', 'RelationKind?'], ['meta', 'json?']]), produces: ['RelationInfoUpdated'] },
  RemoveRelation: { fields: f([['modelId', 'uuid'], ['relationId', 'uuid']]), produces: ['RelationRemoved'] },

  DefineScenario: { fields: f([['modelId', 'uuid'], ['scenarioId', 'uuid'], ['kind', 'GWT|GT'], ['anchorId', 'uuid'], ['given', 'GivenStep[]'], ['when', 'WhenClause?'], ['then', 'ThenClause']]), produces: ['ScenarioDefined'] },
  UpdateScenario: { fields: f([['modelId', 'uuid'], ['scenarioId', 'uuid'], ['anchorId', 'uuid'], ['given', 'GivenStep[]'], ['when', 'WhenClause?'], ['then', 'ThenClause']]), produces: ['ScenarioUpdated'] },
  ArchiveScenario: { fields: f([['modelId', 'uuid'], ['scenarioId', 'uuid']]), produces: ['ScenarioArchived'] },
};

// Derived field (F7): computed by the projection, no upstream source expected.
const d = (fieldName, fieldType) => ({ fieldName, fieldType, derived: true });

// name -> { fields, mode?, fedBy: [facts], displayedBy: [wireframes] }
// mode (F7): 'live' = assembled from other read models (model_export/validation/
// where_used); everything else defaults to 'projected'.
const CATALOG_FACTS = Object.keys(FACTS).filter((n) =>
  /^(BusinessFact|Command|ReadModel|Wireframe|ExternalBusinessFact|Automation|Translation)/.test(n));
const READMODELS = {
  models: {
    fields: [...f([['modelId', 'uuid'], ['name', 'string']]), d('archived', 'bool'), d('sliceCount', 'int')],
    fedBy: ['ModelCreated', 'ModelRenamed', 'ModelArchived', 'SliceDefined', 'SliceArchived'],
    displayedBy: ['Models List Screen'],
  },
  entity_catalog: {
    fields: [
      ...f([['entityId', 'uuid'], ['modelId', 'uuid'], ['name', 'string'], ['contextId', 'uuid? (facts only)'], ['chapterId', 'uuid? (slices only, C1)']]),
      d('entityType', 'string'),
      d('archived', 'bool'),
      d('definition', 'fields | content | triggerConfig | mapping'),
      d('definedAtPosition', 'bigint (global log position)'),
    ],
    fedBy: [...CATALOG_FACTS, 'SliceAssignedToChapter', 'SliceChapterCleared'],
    displayedBy: ['Entity Palette Screen', 'Entity Inspector Screen'],
  },
  contexts: {
    fields: [...f([['contextId', 'uuid'], ['modelId', 'uuid'], ['name', 'string']]), d('archived', 'bool'), d('factCount', 'int')],
    fedBy: ['ContextDefined', 'ContextRenamed', 'ContextArchived', 'BusinessFactAssignedToContext', 'BusinessFactContextCleared', 'ExternalBusinessFactAssignedToContext', 'ExternalBusinessFactContextCleared'],
    displayedBy: ['Entity Inspector Screen'],
  },
  chapters: {
    fields: [...f([['chapterId', 'uuid'], ['modelId', 'uuid'], ['name', 'string']]), d('archived', 'bool'), d('definedAtPosition', 'bigint (band order)')],
    fedBy: ['ChapterDefined', 'ChapterRenamed', 'ChapterArchived'],
    displayedBy: ['Slice Canvas Screen'],
  },
  slice_placements: {
    fields: [...f([['sliceId', 'uuid'], ['modelId', 'uuid'], ['name', 'string'], ['chapterId', 'uuid? (C1)']]), d('archived', 'bool'), d('placements', '[{placedEntityId, slotRole, slot}]')],
    fedBy: ['SliceDefined', 'SliceRenamed', 'SliceArchived', 'EntityPlaced', 'EntitySlotsSwapped', 'EntityRemovedFromSlice', 'SliceAssignedToChapter', 'SliceChapterCleared'],
    displayedBy: [],
  },
  relations_graph: {
    fields: f([['relationId', 'uuid'], ['modelId', 'uuid'], ['fromId', 'uuid'], ['toId', 'uuid'], ['kind', 'RelationKind (stored, F4)'], ['meta', 'json?']]),
    fedBy: ['RelationDrawn', 'RelationInfoUpdated', 'RelationRemoved'],
    displayedBy: [],
  },
  scenarios: {
    fields: [
      ...f([['scenarioId', 'uuid'], ['modelId', 'uuid'], ['kind', 'GWT|GT'], ['anchorId', 'uuid'], ['given', 'GivenStep[]'], ['when', 'WhenClause?'], ['then', 'ThenClause']]),
      d('referencedEntityIds', 'uuid[] (F6 index)'),
      d('outOfSync', 'bool (derived at read)'),
    ],
    fedBy: ['ScenarioDefined', 'ScenarioUpdated', 'ScenarioArchived'],
    displayedBy: ['Slice Canvas Screen'],
  },
  slice_canvas: {
    fields: [
      ...f([['sliceId', 'uuid'], ['modelId', 'uuid'], ['name', 'string']]),
      d('placements', 'joined with entity_catalog: name/type/definition/lane'),
      d('relations', 'edges among visible entities (stored kind)'),
      d('scenarios', 'auto-surfaced via referencedEntityIds (F6)'),
    ],
    fedBy: ['SliceDefined', 'SliceRenamed', 'SliceArchived', 'EntityPlaced', 'EntitySlotsSwapped', 'EntityRemovedFromSlice', 'RelationDrawn', 'RelationInfoUpdated', 'RelationRemoved', 'ScenarioDefined', 'ScenarioUpdated', 'ScenarioArchived'],
    displayedBy: ['Slice Canvas Screen'],
  },
  model_export: {
    mode: 'live', // assembled on demand from the other read models (current-state snapshot)
    fields: f([['modelId', 'uuid'], ['entities', 'CatalogEntry[]'], ['relations', 'RelationEdge[]'], ['slices', 'SlicePlacements[]'], ['contexts', 'Context[]'], ['chapters', 'Chapter[] (C1)'], ['scenarios', 'Scenario[]']]),
    fedBy: [],
    displayedBy: [],
  },
  model_validation: {
    mode: 'live', // computed per request over entity_catalog + relations_graph + scenarios
    fields: f([['modelId', 'uuid'], ['findings', 'advisory completeness findings (A2; never gates; respects F7 derived/live markers)']]),
    fedBy: [],
    displayedBy: ['Slice Canvas Screen'],
  },
  where_used: {
    mode: 'live', // computed per request (A2 where-used)
    fields: f([['entityId', 'uuid'], ['slices', '[{sliceId, name}]'], ['relations', '[{relationId, fromId, toId, kind}]'], ['scenarios', '[{scenarioId, kind, anchorId}]']]),
    fedBy: [],
    displayedBy: ['Entity Inspector Screen'],
  },
};

const WIREFRAMES = {
  'Models List Screen': {
    content: [
      '+--------------------------------------+',
      '| Event Modeler            [ Logout ]  |',
      '+--------------------------------------+',
      '| Your models           [ + New model ]|',
      '|  - EventModeler   12 slices  [ren][x]|',
      '|  - <model name>    n slices  [ren][x]|',
      '+--------------------------------------+',
    ].join('\n'),
    issues: ['CreateModel', 'RenameModel', 'ArchiveModel'],
  },
  'Entity Palette Screen': {
    content: [
      '+-- Palette (W3) --+',
      '| [+ Business Fact]|',
      '| [+ Command]      |',
      '| [+ Read Model]   |',
      '| [+ Wireframe]    |',
      '| [+ External Fact]|',
      '| [+ Automation]   |',
      '| [+ Translation]  |',
      '+------------------+',
    ].join('\n'),
    issues: ['DefineBusinessFact', 'DefineCommand', 'DefineReadModel', 'DefineWireframe', 'DefineExternalBusinessFact', 'DefineAutomation', 'DefineTranslation'],
  },
  'Slice Canvas Screen': {
    content: [
      '+-- Workspace canvas (W4) — slices tile left->right in creation order --+',
      '| [slice: Create Model]  [slice: Define Business Fact]  [+ New slice]  |',
      '|  trigger band: wireframes / automation / translation                 |',
      '|  command band: ONE command                                           |',
      '|  read-model band / fact band (lane = fact contextId)                 |',
      '|  edges: typed relations (stored kind) · GWTs auto-surface            |',
      '+----------------------------------------------------------------------+',
    ].join('\n'),
    issues: ['DefineSlice', 'RenameSlice', 'ArchiveSlice', 'PlaceEntity', 'SwapEntitySlots', 'RemoveEntityFromSlice', 'DrawRelation', 'UpdateRelationInfo', 'RemoveRelation', 'DefineScenario', 'UpdateScenario', 'ArchiveScenario', 'DefineChapter', 'RenameChapter', 'ArchiveChapter', 'AssignSliceToChapter', 'ClearSliceChapter'],
  },
  'Entity Inspector Screen': {
    content: [
      '+-- Inspector (W5/W6) --+',
      '| Name: [____] [Rename] |',
      '| Fields editor (O4 free-form types) [Save] |',
      '| Lane: [context v] [Assign] [Clear]  (facts only) |',
      '| Where used: slices / relations / scenarios |',
      '| [Archive]             |',
      '+-----------------------+',
    ].join('\n'),
    issues: [
      'RenameBusinessFact', 'UpdateBusinessFactFields', 'ArchiveBusinessFact', 'AssignBusinessFactToContext', 'ClearBusinessFactContext',
      'RenameCommand', 'UpdateCommandFields', 'ArchiveCommand',
      'RenameReadModel', 'UpdateReadModelFields', 'ArchiveReadModel',
      'RenameWireframe', 'UpdateWireframeContent', 'ArchiveWireframe',
      'RenameExternalBusinessFact', 'UpdateExternalBusinessFactFields', 'ArchiveExternalBusinessFact', 'AssignExternalBusinessFactToContext', 'ClearExternalBusinessFactContext',
      'RenameAutomation', 'ReconfigureAutomation', 'ArchiveAutomation',
      'RenameTranslation', 'UpdateTranslationMapping', 'ArchiveTranslation',
      'DefineContext', 'RenameContext', 'ArchiveContext',
    ],
  },
};

// Slices: w = wireframes (trigger), a = automations (trigger), c = single command,
// r = read models, fx = facts.
const SLICES = [
  // Setup
  { name: 'Create Model', w: ['Models List Screen'], c: 'CreateModel', fx: ['ModelCreated'] },
  { name: 'Rename Model', w: ['Models List Screen'], c: 'RenameModel', fx: ['ModelRenamed'] },
  { name: 'Archive Model', w: ['Models List Screen'], c: 'ArchiveModel', fx: ['ModelArchived'] },
  { name: 'Models List', w: ['Models List Screen'], r: ['models'], fx: ['ModelCreated', 'ModelRenamed', 'ModelArchived'] },
  // Catalog — businessFact (E1, the template vertical)
  { name: 'Define Business Fact', w: ['Entity Palette Screen'], c: 'DefineBusinessFact', fx: ['BusinessFactDefined'] },
  { name: 'Rename Business Fact', w: ['Entity Inspector Screen'], c: 'RenameBusinessFact', fx: ['BusinessFactRenamed'] },
  { name: 'Update Business Fact Fields', w: ['Entity Inspector Screen'], c: 'UpdateBusinessFactFields', fx: ['BusinessFactFieldsUpdated'] },
  { name: 'Archive Business Fact', w: ['Entity Inspector Screen'], c: 'ArchiveBusinessFact', fx: ['BusinessFactArchived'] },
  // Catalog — command (E2)
  { name: 'Define Command', w: ['Entity Palette Screen'], c: 'DefineCommand', fx: ['CommandDefined'] },
  { name: 'Rename Command', w: ['Entity Inspector Screen'], c: 'RenameCommand', fx: ['CommandRenamed'] },
  { name: 'Update Command Fields', w: ['Entity Inspector Screen'], c: 'UpdateCommandFields', fx: ['CommandFieldsUpdated'] },
  { name: 'Archive Command', w: ['Entity Inspector Screen'], c: 'ArchiveCommand', fx: ['CommandArchived'] },
  // Catalog — readModel (E3)
  { name: 'Define Read Model', w: ['Entity Palette Screen'], c: 'DefineReadModel', fx: ['ReadModelDefined'] },
  { name: 'Rename Read Model', w: ['Entity Inspector Screen'], c: 'RenameReadModel', fx: ['ReadModelRenamed'] },
  { name: 'Update Read Model Fields', w: ['Entity Inspector Screen'], c: 'UpdateReadModelFields', fx: ['ReadModelFieldsUpdated'] },
  { name: 'Archive Read Model', w: ['Entity Inspector Screen'], c: 'ArchiveReadModel', fx: ['ReadModelArchived'] },
  // Catalog — wireframe (E4)
  { name: 'Define Wireframe', w: ['Entity Palette Screen'], c: 'DefineWireframe', fx: ['WireframeDefined'] },
  { name: 'Rename Wireframe', w: ['Entity Inspector Screen'], c: 'RenameWireframe', fx: ['WireframeRenamed'] },
  { name: 'Update Wireframe Content', w: ['Entity Inspector Screen'], c: 'UpdateWireframeContent', fx: ['WireframeContentUpdated'] },
  { name: 'Archive Wireframe', w: ['Entity Inspector Screen'], c: 'ArchiveWireframe', fx: ['WireframeArchived'] },
  // Catalog — externalBusinessFact (E5)
  { name: 'Define External Business Fact', w: ['Entity Palette Screen'], c: 'DefineExternalBusinessFact', fx: ['ExternalBusinessFactDefined'] },
  { name: 'Rename External Business Fact', w: ['Entity Inspector Screen'], c: 'RenameExternalBusinessFact', fx: ['ExternalBusinessFactRenamed'] },
  { name: 'Update External Business Fact Fields', w: ['Entity Inspector Screen'], c: 'UpdateExternalBusinessFactFields', fx: ['ExternalBusinessFactFieldsUpdated'] },
  { name: 'Archive External Business Fact', w: ['Entity Inspector Screen'], c: 'ArchiveExternalBusinessFact', fx: ['ExternalBusinessFactArchived'] },
  { name: 'Assign External Fact To Context', w: ['Entity Inspector Screen'], c: 'AssignExternalBusinessFactToContext', fx: ['ExternalBusinessFactAssignedToContext'] },
  { name: 'Clear External Fact Context', w: ['Entity Inspector Screen'], c: 'ClearExternalBusinessFactContext', fx: ['ExternalBusinessFactContextCleared'] },
  // Catalog — automation (E6, divergent)
  { name: 'Define Automation', w: ['Entity Palette Screen'], c: 'DefineAutomation', fx: ['AutomationDefined'] },
  { name: 'Rename Automation', w: ['Entity Inspector Screen'], c: 'RenameAutomation', fx: ['AutomationRenamed'] },
  { name: 'Reconfigure Automation', w: ['Entity Inspector Screen'], c: 'ReconfigureAutomation', fx: ['AutomationReconfigured'] },
  { name: 'Archive Automation', w: ['Entity Inspector Screen'], c: 'ArchiveAutomation', fx: ['AutomationArchived'] },
  // Catalog — translation (E7, divergent)
  { name: 'Define Translation', w: ['Entity Palette Screen'], c: 'DefineTranslation', fx: ['TranslationDefined'] },
  { name: 'Rename Translation', w: ['Entity Inspector Screen'], c: 'RenameTranslation', fx: ['TranslationRenamed'] },
  { name: 'Update Translation Mapping', w: ['Entity Inspector Screen'], c: 'UpdateTranslationMapping', fx: ['TranslationMappingUpdated'] },
  { name: 'Archive Translation', w: ['Entity Inspector Screen'], c: 'ArchiveTranslation', fx: ['TranslationArchived'] },
  // Catalog view
  { name: 'Entity Catalog', w: ['Entity Palette Screen', 'Entity Inspector Screen'], r: ['entity_catalog'], fx: ['BusinessFactDefined', 'CommandDefined', 'ReadModelDefined', 'WireframeDefined', 'ExternalBusinessFactDefined', 'AutomationDefined', 'TranslationDefined'] },
  // Streams (X1)
  { name: 'Define Context', w: ['Entity Inspector Screen'], c: 'DefineContext', fx: ['ContextDefined'] },
  { name: 'Rename Context', w: ['Entity Inspector Screen'], c: 'RenameContext', fx: ['ContextRenamed'] },
  { name: 'Archive Context', w: ['Entity Inspector Screen'], c: 'ArchiveContext', fx: ['ContextArchived'] },
  { name: 'Assign Fact To Context', w: ['Entity Inspector Screen'], c: 'AssignBusinessFactToContext', fx: ['BusinessFactAssignedToContext'] },
  { name: 'Clear Fact Context', w: ['Entity Inspector Screen'], c: 'ClearBusinessFactContext', fx: ['BusinessFactContextCleared'] },
  { name: 'Contexts List', w: ['Entity Inspector Screen'], r: ['contexts'], fx: ['ContextDefined', 'ContextRenamed', 'ContextArchived', 'BusinessFactAssignedToContext', 'BusinessFactContextCleared'] },
  // Assembly (S1 + R1 + S2)
  { name: 'Define Slice', w: ['Slice Canvas Screen'], c: 'DefineSlice', fx: ['SliceDefined'] },
  { name: 'Rename Slice', w: ['Slice Canvas Screen'], c: 'RenameSlice', fx: ['SliceRenamed'] },
  { name: 'Archive Slice', w: ['Slice Canvas Screen'], c: 'ArchiveSlice', fx: ['SliceArchived'] },
  { name: 'Place Entity', w: ['Slice Canvas Screen'], c: 'PlaceEntity', fx: ['EntityPlaced'] },
  { name: 'Swap Entity Slots', w: ['Slice Canvas Screen'], c: 'SwapEntitySlots', fx: ['EntitySlotsSwapped'] },
  { name: 'Remove Entity From Slice', w: ['Slice Canvas Screen'], c: 'RemoveEntityFromSlice', fx: ['EntityRemovedFromSlice'] },
  { name: 'Draw Relation', w: ['Slice Canvas Screen'], c: 'DrawRelation', fx: ['RelationDrawn'] },
  { name: 'Update Relation Info', w: ['Slice Canvas Screen'], c: 'UpdateRelationInfo', fx: ['RelationInfoUpdated'] },
  { name: 'Remove Relation', w: ['Slice Canvas Screen'], c: 'RemoveRelation', fx: ['RelationRemoved'] },
  { name: 'Slice Canvas', w: ['Slice Canvas Screen'], r: ['slice_placements', 'relations_graph', 'slice_canvas'], fx: ['EntityPlaced', 'EntitySlotsSwapped', 'EntityRemovedFromSlice', 'RelationDrawn', 'RelationInfoUpdated', 'RelationRemoved'] },
  // Rules (V1)
  { name: 'Define Scenario', w: ['Slice Canvas Screen'], c: 'DefineScenario', fx: ['ScenarioDefined'] },
  { name: 'Update Scenario', w: ['Slice Canvas Screen'], c: 'UpdateScenario', fx: ['ScenarioUpdated'] },
  { name: 'Archive Scenario', w: ['Slice Canvas Screen'], c: 'ArchiveScenario', fx: ['ScenarioArchived'] },
  { name: 'Scenarios Auto-Surface', w: ['Slice Canvas Screen'], r: ['scenarios'], fx: ['ScenarioDefined', 'ScenarioUpdated', 'ScenarioArchived'] },
  // Organize (C1 chapter band)
  { name: 'Define Chapter', w: ['Slice Canvas Screen'], c: 'DefineChapter', fx: ['ChapterDefined'] },
  { name: 'Rename Chapter', w: ['Slice Canvas Screen'], c: 'RenameChapter', fx: ['ChapterRenamed'] },
  { name: 'Archive Chapter', w: ['Slice Canvas Screen'], c: 'ArchiveChapter', fx: ['ChapterArchived'] },
  { name: 'Assign Slice To Chapter', w: ['Slice Canvas Screen'], c: 'AssignSliceToChapter', fx: ['SliceAssignedToChapter'] },
  { name: 'Clear Slice Chapter', w: ['Slice Canvas Screen'], c: 'ClearSliceChapter', fx: ['SliceChapterCleared'] },
  { name: 'Chapters Band', w: ['Slice Canvas Screen'], r: ['chapters'], fx: ['ChapterDefined', 'ChapterRenamed', 'ChapterArchived', 'SliceAssignedToChapter', 'SliceChapterCleared'] },
  // React (A1 archive cascade — E4b: TWO processors, one issued command type each)
  { name: 'Cascade Remove Placements', a: ['Cascade Placements'], c: 'RemoveEntityFromSlice', r: ['slice_placements'], fx: ['EntityRemovedFromSlice'] },
  { name: 'Cascade Remove Relations', a: ['Cascade Relations'], c: 'RemoveRelation', r: ['relations_graph'], fx: ['RelationRemoved'] },
  // Analyze (A2) + Export
  { name: 'Model Validation', w: ['Slice Canvas Screen'], r: ['model_validation'] },
  { name: 'Where Used', w: ['Entity Inspector Screen'], r: ['where_used'] },
  { name: 'Model Export', r: ['model_export'] },
];

// Slice → chapter band assignment (C1). Anything not listed = Catalog.
const CHAPTER_OF = (() => {
  const m = {};
  const assign = (ch, names) => names.forEach((n) => (m[n] = ch));
  assign('Setup', ['Create Model', 'Rename Model', 'Archive Model', 'Models List']);
  assign('Streams', ['Define Context', 'Rename Context', 'Archive Context', 'Assign Fact To Context', 'Clear Fact Context', 'Contexts List', 'Assign External Fact To Context', 'Clear External Fact Context']);
  assign('Assembly', ['Define Slice', 'Rename Slice', 'Archive Slice', 'Place Entity', 'Swap Entity Slots', 'Remove Entity From Slice', 'Draw Relation', 'Update Relation Info', 'Remove Relation', 'Slice Canvas']);
  assign('Rules', ['Define Scenario', 'Update Scenario', 'Archive Scenario', 'Scenarios Auto-Surface']);
  assign('Organize', ['Define Chapter', 'Rename Chapter', 'Archive Chapter', 'Assign Slice To Chapter', 'Clear Slice Chapter', 'Chapters Band']);
  assign('React', ['Cascade Remove Placements', 'Cascade Remove Relations']);
  assign('Analyze', ['Model Validation', 'Where Used', 'Model Export']);
  return (name) => m[name] ?? 'Catalog';
})();

// ---------------------------------------------------------------------------
// BUILD
// ---------------------------------------------------------------------------

const main = async () => {
  await login();

  // Supersede any previous self-model build (keeps the workspace list clean).
  const existing = await req('GET', '/models');
  if (Array.isArray(existing.json)) {
    for (const m of existing.json) {
      if (m.name === 'EventModeler') {
        await req('DELETE', `/models/${m._id}`);
        console.log('archived previous EventModeler model:', m._id);
      }
    }
  }

  const create = await req('POST', '/models', { name: 'EventModeler' });
  if (create.status !== 200) throw new Error('create model failed: ' + JSON.stringify(create.json));
  const modelId = create.json.modelId;
  console.log('modelId:', modelId);

  const ctxIds = {}; // context name -> id
  for (const name of CONTEXTS) {
    const contextId = uuid();
    const r = await reqRetry('POST', '/contexts', { modelId, contextId, name }, `context ${name}`);
    if (r?.status < 400) ctxIds[name] = contextId;
  }
  console.log('contexts:', Object.keys(ctxIds).length);

  const ids = {}; // entity name -> id (facts, commands, read models, wireframes, automations)

  for (const [name, def] of Object.entries(FACTS)) {
    const entityId = uuid();
    const r = await reqRetry('POST', '/business-facts', { modelId, entityId, name, fields: def.fields }, `fact ${name}`);
    if (r?.status < 400) ids[name] = entityId;
  }
  console.log('facts:', Object.keys(ids).length);

  // lane assignment (retries cover contexts-projection lag)
  for (const [name, def] of Object.entries(FACTS)) {
    if (!ids[name] || !ctxIds[def.lane]) continue;
    await reqRetry('PUT', `/business-facts/${ids[name]}/context`, { contextId: ctxIds[def.lane] }, `lane ${name}`);
  }
  console.log('lanes assigned');

  for (const [name, def] of Object.entries(COMMANDS)) {
    const entityId = uuid();
    const r = await reqRetry('POST', '/commands', { modelId, entityId, name, fields: def.fields }, `command ${name}`);
    if (r?.status < 400) ids[name] = entityId;
  }
  for (const [name, def] of Object.entries(READMODELS)) {
    const entityId = uuid();
    const r = await reqRetry(
      'POST',
      '/read-models',
      { modelId, entityId, name, fields: def.fields, ...(def.mode ? { mode: def.mode } : {}) },
      `readModel ${name}`,
    );
    if (r?.status < 400) ids[name] = entityId;
  }
  for (const [name, def] of Object.entries(WIREFRAMES)) {
    const entityId = uuid();
    const r = await reqRetry('POST', '/wireframes', { modelId, entityId, name, content: def.content }, `wireframe ${name}`);
    if (r?.status < 400) ids[name] = entityId;
  }
  console.log('commands + read models + wireframes done');

  // A1 cascade — E4b: TWO automations, one issued command type each (es-book
  // ch 35). Refs need the catalog projection to have caught up.
  const CASCADES = [
    { name: 'Cascade Placements', monitored: 'slice_placements', issued: 'RemoveEntityFromSlice' },
    { name: 'Cascade Relations', monitored: 'relations_graph', issued: 'RemoveRelation' },
  ];
  for (const c of CASCADES) {
    const entityId = uuid();
    const r = await reqRetry('POST', '/automations', {
      modelId, entityId, name: c.name,
      triggerConfig: {
        triggerType: 'fact',
        monitoredReadModelId: ids[c.monitored],
        issuedCommandId: ids[c.issued],
      },
    }, `automation ${c.name}`);
    if (r?.status < 400) ids[c.name] = entityId;
  }

  // Slices + placements
  const sliceIds = {};
  for (const s of SLICES) {
    const sliceId = uuid();
    const r = await reqRetry('POST', '/slices', { modelId, sliceId, name: s.name }, `slice ${s.name}`);
    if (!(r?.status < 400)) continue;
    sliceIds[s.name] = sliceId;
    // s.r (read models) are NOT placed — the canvas auto-displays them from
    // displayedBy/monitoredBy relations (drawn below).
    const order = [...(s.w ?? []), ...(s.a ?? []), ...(s.c ? [s.c] : []), ...(s.fx ?? [])];
    for (const ent of order) {
      if (!ids[ent]) { failures.push(`placement ${s.name}/${ent}: no entity id`); continue; }
      await reqRetry('POST', `/slices/${sliceId}/placements`, { placedEntityId: ids[ent] }, `place ${ent} on ${s.name}`);
    }
  }
  console.log('slices:', Object.keys(sliceIds).length);

  // C1: the model's own chapter band + per-slice assignment (422-retry covers
  // the chapters/slice_placements projection lag).
  const chapterIds = {};
  for (const name of CHAPTERS) {
    const chapterId = uuid();
    const r = await reqRetry('POST', '/chapters', { modelId, chapterId, name }, `chapter ${name}`);
    if (r?.status < 400) chapterIds[name] = chapterId;
  }
  let chaptersAssigned = 0;
  for (const s of SLICES) {
    const sliceId = sliceIds[s.name];
    const chapterId = chapterIds[CHAPTER_OF(s.name)];
    if (!sliceId || !chapterId) continue;
    const r = await reqRetry('PUT', `/slices/${sliceId}/chapter`, { chapterId }, `chapter assign ${s.name}`);
    if (r?.status < 400) chaptersAssigned++;
  }
  console.log(`chapters: ${Object.keys(chapterIds).length}, slices assigned: ${chaptersAssigned}/${SLICES.length}`);

  // Relations — derived, deduped on (from, to, kind)
  const rels = new Map();
  const addRel = (fromName, toName, kind) => {
    if (!ids[fromName] || !ids[toName]) return;
    rels.set(`${fromName}|${toName}|${kind}`, { fromId: ids[fromName], toId: ids[toName], kind });
  };
  for (const [wf, def] of Object.entries(WIREFRAMES)) for (const c of def.issues) addRel(wf, c, 'issues');
  for (const [c, def] of Object.entries(COMMANDS)) for (const fact of def.produces) addRel(c, fact, 'produces');
  for (const [rm, def] of Object.entries(READMODELS)) {
    for (const fact of def.fedBy) addRel(fact, rm, 'feeds');
    for (const wf of def.displayedBy) addRel(rm, wf, 'displayedBy');
  }
  addRel('slice_placements', 'Cascade Placements', 'monitoredBy');
  addRel('relations_graph', 'Cascade Relations', 'monitoredBy');
  addRel('Cascade Placements', 'RemoveEntityFromSlice', 'reacts');
  addRel('Cascade Relations', 'RemoveRelation', 'reacts');
  let drawn = 0;
  for (const [key, rel] of rels) {
    const r = await reqRetry('POST', '/relations', { modelId, relationId: uuid(), ...rel }, `relation ${key}`);
    if (r?.status < 400) drawn++;
  }
  console.log(`relations: ${drawn}/${rels.size}`);

  // Scenarios — key business rules (GWT on commands, GT on read models / automation)
  const SCENARIOS = [
    { kind: 'GWT', anchor: 'DefineBusinessFact', given: [], when: { values: { name: 'OrderPlaced', fields: [{ fieldName: 'orderId', fieldType: 'uuid' }] } }, then: { emit: [{ fact: 'BusinessFactDefined', values: { name: 'OrderPlaced' } }] } },
    { kind: 'GWT', anchor: 'DefineBusinessFact', given: [{ fact: 'BusinessFactDefined', values: { name: 'OrderPlaced' } }], when: { values: { name: 'OrderPlaced' } }, then: { reject: { reason: 'duplicate name within model — entity_names (modelId, normalized_name) constraint (F1b)' } } },
    { kind: 'GWT', anchor: 'DefineBusinessFact', given: [], when: { values: { name: '   ' } }, then: { reject: { reason: 'blank / whitespace-only name (G-C1)' } } },
    { kind: 'GWT', anchor: 'DefineBusinessFact', given: [{ fact: 'BusinessFactDefined', values: { name: 'OrderPlaced' } }, { fact: 'BusinessFactArchived' }], when: { values: { name: 'OrderPlaced' } }, then: { emit: [{ fact: 'BusinessFactDefined', values: { name: 'OrderPlaced' } }] } },
    { kind: 'GWT', anchor: 'DefineBusinessFact', given: [], when: { values: { name: 'X', fields: [{ fieldName: 'a', fieldType: 'string' }, { fieldName: 'A', fieldType: 'int' }] } }, then: { reject: { reason: 'duplicate fieldName within one definition (case-insensitive)' } } },
    { kind: 'GWT', anchor: 'RenameModel', given: [{ fact: 'ModelCreated', values: { name: 'A' } }, { fact: 'ModelArchived' }], when: { values: { name: 'B' } }, then: { reject: { reason: 'cannot edit an archived model' } } },
    { kind: 'GWT', anchor: 'PlaceEntity', given: [{ fact: 'EntityPlaced', values: { slotRole: 'command' } }], when: { values: { entityType: 'command' } }, then: { reject: { reason: 'command band holds exactly one (F3 cardinality; same for automation/translation)' } } },
    { kind: 'GWT', anchor: 'PlaceEntity', given: [{ fact: 'EntityPlaced', values: { placedEntityId: 'E' } }], when: { values: { placedEntityId: 'E' } }, then: { reject: { reason: 'one placement per (slice, entity)' } } },
    { kind: 'GWT', anchor: 'SwapEntitySlots', given: [{ fact: 'EntityPlaced', values: { slot: 0 } }, { fact: 'EntityPlaced', values: { slot: 1 } }], when: { values: { entityIdA: 'A', entityIdB: 'B' } }, then: { emit: [{ fact: 'EntitySlotsSwapped', values: { entityIdA: 'A', entityIdB: 'B' } }] } },
    { kind: 'GWT', anchor: 'DrawRelation', given: [], when: { values: { fromType: 'command', toType: 'wireframe' } }, then: { reject: { reason: 'pair not in the 11-pair allow-list (F4); submitted kind must match the pair' } } },
    { kind: 'GWT', anchor: 'DrawRelation', given: [{ fact: 'RelationDrawn', values: { kind: 'produces' } }], when: { values: { kind: 'produces' } }, then: { reject: { reason: 'duplicate (fromId, toId, kind) — relation_pairs inline constraint (E3)' } } },
    { kind: 'GWT', anchor: 'AssignBusinessFactToContext', given: [], when: { values: { entityType: 'command' } }, then: { reject: { reason: 'only business facts / external facts are laned; commands and read models are lane-agnostic' } } },
    { kind: 'GT', anchor: 'models', given: [{ fact: 'ModelCreated', values: { name: 'A' } }, { fact: 'ModelRenamed', values: { name: 'B' } }], then: { state: { name: 'B', archived: false, sliceCount: 0 } } },
    { kind: 'GT', anchor: 'entity_catalog', given: [{ fact: 'BusinessFactDefined', values: { name: 'OrderPlaced' } }, { fact: 'BusinessFactAssignedToContext', values: { contextId: 'ctx-payments' } }], then: { state: { contextId: 'ctx-payments', archived: false } } },
    { kind: 'GT', anchor: 'scenarios', given: [{ fact: 'ScenarioDefined' }, { fact: 'BusinessFactArchived' }], then: { state: { outOfSync: true } } },
    { kind: 'GT', anchor: 'Cascade Placements', given: [{ fact: 'BusinessFactArchived' }, { fact: 'EntityPlaced' }], then: { state: { issues: 'RemoveEntityFromSlice for every surviving placement of the archived entity (E4b fan-out)' } } },
    { kind: 'GT', anchor: 'Cascade Relations', given: [{ fact: 'BusinessFactArchived' }, { fact: 'RelationDrawn' }], then: { state: { issues: 'RemoveRelation for every edge touching the archived entity (E4b fan-out)' } } },
  ];
  let scen = 0;
  for (const s of SCENARIOS) {
    if (!ids[s.anchor]) { failures.push(`scenario anchor missing: ${s.anchor}`); continue; }
    const mapGiven = (g) => ({ factId: ids[g.fact] ?? g.fact, ...(g.exists === false ? { exists: false } : {}), ...(g.values ? { values: g.values } : {}) });
    const then = s.then.emit
      ? { emit: s.then.emit.map((e) => ({ factId: ids[e.fact] ?? e.fact, ...(e.values ? { values: e.values } : {}) })) }
      : s.then;
    const body = {
      modelId, scenarioId: uuid(), kind: s.kind, anchorId: ids[s.anchor],
      given: (s.given ?? []).map(mapGiven),
      ...(s.when ? { when: s.when } : {}),
      then,
    };
    const r = await reqRetry('POST', '/scenarios', body, `scenario ${s.kind} ${s.anchor}`);
    if (r?.status < 400) scen++;
  }
  console.log(`scenarios: ${scen}/${SCENARIOS.length}`);

  // Verify
  await sleep(1500);
  const [entities, slices, validation] = await Promise.all([
    req('GET', `/models/${modelId}/entities`),
    req('GET', `/models/${modelId}/slices`),
    req('GET', `/models/${modelId}/validation`),
  ]);
  console.log('\n=== SUMMARY ===');
  console.log('modelId:', modelId);
  console.log('catalog entities:', Array.isArray(entities.json) ? entities.json.length : entities.json);
  console.log('slices:', Array.isArray(slices.json) ? slices.json.length : slices.json);
  console.log('validation findings:', validation.json?.findings?.length ?? validation.json);
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`);
    for (const f of failures.slice(0, 50)) console.log(' -', f);
  } else {
    console.log('\nNo failures.');
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
