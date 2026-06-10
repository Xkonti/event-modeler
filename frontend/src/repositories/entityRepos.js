// Registry: entityType → its repository's composables. Lets the
// type-parameterized inspector (W5/6) dispatch without a 7-way import block in
// every component. Values are composable FUNCTIONS — call them in setup() only.
import * as fact from '@/repositories/businessFactRepository'
import * as externalFact from '@/repositories/externalBusinessFactRepository'
import * as command from '@/repositories/commandRepository'
import * as readModel from '@/repositories/readModelRepository'
import * as wireframe from '@/repositories/wireframeRepository'
import * as automation from '@/repositories/automationRepository'
import * as translation from '@/repositories/translationRepository'

/**
 * Per-type composable map. `payloadKind` tells the inspector which editor the
 * type gets (fields grid / wireframe content / automation trigger config /
 * translation mapping); `hasLane` adds the Lane control (facts only).
 */
export const ENTITY_REPOS = {
  businessFact: {
    label: 'Business fact',
    payloadKind: 'fields',
    hasLane: true,
    useEntity: fact.useBusinessFact,
    useDefine: fact.useDefineBusinessFact,
    useRename: fact.useRenameBusinessFact,
    useUpdatePayload: fact.useUpdateBusinessFactFields,
    useArchive: fact.useArchiveBusinessFact,
    useAssignContext: fact.useAssignBusinessFactContext,
    useClearContext: fact.useClearBusinessFactContext,
  },
  externalBusinessFact: {
    label: 'External business fact',
    payloadKind: 'fields',
    hasLane: true,
    useEntity: externalFact.useExternalBusinessFact,
    useDefine: externalFact.useDefineExternalBusinessFact,
    useRename: externalFact.useRenameExternalBusinessFact,
    useUpdatePayload: externalFact.useUpdateExternalBusinessFactFields,
    useArchive: externalFact.useArchiveExternalBusinessFact,
    useAssignContext: externalFact.useAssignExternalBusinessFactContext,
    useClearContext: externalFact.useClearExternalBusinessFactContext,
  },
  command: {
    label: 'Command',
    payloadKind: 'fields',
    hasLane: false,
    useEntity: command.useCommand,
    useDefine: command.useDefineCommand,
    useRename: command.useRenameCommand,
    useUpdatePayload: command.useUpdateCommandFields,
    useArchive: command.useArchiveCommand,
  },
  readModel: {
    label: 'Read model',
    payloadKind: 'fields',
    hasLane: false,
    useEntity: readModel.useReadModel,
    useDefine: readModel.useDefineReadModel,
    useRename: readModel.useRenameReadModel,
    useUpdatePayload: readModel.useUpdateReadModelFields,
    useArchive: readModel.useArchiveReadModel,
  },
  wireframe: {
    label: 'Wireframe',
    payloadKind: 'content',
    hasLane: false,
    useEntity: wireframe.useWireframe,
    useDefine: wireframe.useDefineWireframe,
    useRename: wireframe.useRenameWireframe,
    useUpdatePayload: wireframe.useUpdateWireframeContent,
    useArchive: wireframe.useArchiveWireframe,
  },
  automation: {
    label: 'Automation',
    payloadKind: 'triggerConfig',
    hasLane: false,
    useEntity: automation.useAutomation,
    useDefine: automation.useDefineAutomation,
    useRename: automation.useRenameAutomation,
    useUpdatePayload: automation.useReconfigureAutomation,
    useArchive: automation.useArchiveAutomation,
  },
  translation: {
    label: 'Translation',
    payloadKind: 'mapping',
    hasLane: false,
    useEntity: translation.useTranslation,
    useDefine: translation.useDefineTranslation,
    useRename: translation.useRenameTranslation,
    useUpdatePayload: translation.useUpdateTranslationMapping,
    useArchive: translation.useArchiveTranslation,
  },
}
