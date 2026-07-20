// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    Generate,
    extension_prompt_roles,
    extension_prompt_types,
    getCurrentChatId,
    generateRaw,
    messageFormatting,
    saveChatConditional,
    sendMessageAsUser,
    setExtensionPrompt,
} from '../../../../script.js';
import {
    extension_settings,
    getContext,
    saveMetadataDebounced,
} from '../../../extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { DOMPurify, yaml, hljs, morphdom, DiffMatchPatch } from '/lib.js';

import { createEmberRuntime } from './src/core/runtime.js';
import { createPermissionPolicy } from './src/core/permission-policy.js';
import { parseArtifact } from './src/parser/artifact-parser.js';
import { createArtifactStateStore } from './src/integration/artifact-state-store.js';
import { createMessageController } from './src/integration/message-controller.js';
import { createSillyTavernHostActions } from './src/integration/sillytavern-host-actions.js';
import { createTrustedHostLibraries } from './src/libraries/trusted-host-libraries.js';
import { createObservabilityService } from './src/observability/observability-service.js';
import { createPermissionDialog } from './src/ui/permission-dialog.js';
import { createArtifactInspector } from './src/ui/artifact-inspector.js';
import { createSettingsController } from './src/ui/settings-controller.js';
import { createSecureHtmlRenderer } from './src/html/secure-html-renderer.js';
import { createSecureHtmlController } from './src/html/secure-html-controller.js';
import { DEFAULT_ARTIFACT_PROMPT, createArtifactPromptController } from './src/prompt/artifact-prompt.js';
import { diagnoseArtifact } from './src/diagnostics/artifact-diagnostics.js';
import { createRepairPreviewService } from './src/repair/repair-preview-service.js';
import { createModelRepairService } from './src/repair/model-repair-service.js';
import { createArtifactLibraryResolver } from './src/libraries/artifact-library-registry.js';
import { createRepairApplicationService } from './src/repair/repair-application-service.js';
import { createNetworkBroker } from './src/integration/network-broker.js';

const settings = extension_settings.Ember4 ??= {
    permissionDecisions: {},
    secureHtmlRendererEnabled: true,
    secureHtmlMode: 'responses',
    artifactPromptEnabled: true,
    artifactPrompt: DEFAULT_ARTIFACT_PROMPT,
    migrateLegacyJavascript: true,
};
settings.secureHtmlRendererEnabled ??= true;
settings.secureHtmlMode ??= 'responses';
settings.artifactPromptEnabled ??= true;
settings.artifactPrompt ||= DEFAULT_ARTIFACT_PROMPT;
settings.migrateLegacyJavascript ??= true;
const hostLibraries = createTrustedHostLibraries({ DOMPurify, yaml, hljs, morphdom, DiffMatchPatch });
const observability = createObservabilityService();
const requestPermission = createPermissionDialog({
    document: globalThis.document,
    callPopup: callGenericPopup,
    confirmType: POPUP_TYPE.CONFIRM,
});
const permissionPolicy = createPermissionPolicy({
    settings,
    persist: () => getContext().saveSettingsDebounced(),
    confirm: requestPermission,
});
const stateStore = createArtifactStateStore({
    getMetadata: () => getContext().chatMetadata,
    save: saveMetadataDebounced,
});
const networkBroker = createNetworkBroker({
    fetch: globalThis.fetch.bind(globalThis),
    origin: globalThis.location.origin,
    observe: (type, detail) => observability.record(type, detail),
});
const hostActions = createSillyTavernHostActions({
    sendMessage: sendMessageAsUser,
    generate: Generate,
    setPrompt: setExtensionPrompt,
    promptPosition: extension_prompt_types.IN_CHAT,
    promptRole: extension_prompt_roles.SYSTEM,
    stateStore,
    fetchNetwork: request => networkBroker.request(request),
    observe: (type, detail) => observability.record(type, detail),
});
const promptController = createArtifactPromptController({
    settings,
    setPrompt: setExtensionPrompt,
    position: extension_prompt_types.IN_PROMPT,
    role: extension_prompt_roles.SYSTEM,
});
promptController.apply();
const repairPreview = createRepairPreviewService({ libraries: hostLibraries });
const modelRepair = createModelRepairService({ generate: generateRaw, diagnose: diagnoseArtifact });
const artifactLibraries = createArtifactLibraryResolver({
    fetch: globalThis.fetch.bind(globalThis),
    baseUrl: '/scripts/extensions/third-party/Ember',
});

const runtime = createEmberRuntime({
    iframeOptions: {
        actions: hostActions,
        resolvePermissions: request => permissionPolicy.resolve(request),
        resolveLibraries: aliases => artifactLibraries.resolve(aliases),
        onError: ({ session, error }) => {
            observability.record('artifact.error', { artifactId: session.id, error });
            console.error(`[Ember 4:${session.id}]`, error);
        },
        onRejected: error => {
            observability.record('bridge.rejected', { error });
            console.warn('[Ember 4] Rejected artifact request:', error);
        },
    },
    observability,
    compatibility: Object.freeze({
        get secureHtmlOwned() {
            return settings.secureHtmlRendererEnabled;
        },
        get modernPromptOwned() {
            return settings.artifactPromptEnabled;
        },
        get legacyJavascriptOwned() {
            return settings.migrateLegacyJavascript;
        },
    }),
});
globalThis.Ember = runtime.publicApi;

await runtime.start();

const context = getContext();
const repairApplication = createRepairApplicationService({
    getChat: () => getContext().chat,
    getChatId: getCurrentChatId,
    saveChat: saveChatConditional,
    emitEdited: messageId => getContext().eventSource.emit(getContext().event_types.MESSAGE_EDITED, messageId),
});
const openInspector = createArtifactInspector({
    document: globalThis.document,
    callPopup: callGenericPopup,
    displayType: POPUP_TYPE.DISPLAY,
    libraries: hostLibraries,
    observability,
    diagnose: diagnoseArtifact,
    repairPreview,
    modelRepair,
    repairApplication,
    confirmType: POPUP_TYPE.CONFIRM,
});
const messageController = createMessageController({
    eventSource: context.eventSource,
    events: context.event_types,
    getChat: () => getContext().chat,
    getChatId: getCurrentChatId,
    document: globalThis.document,
    parseArtifact: message => parseArtifact(message, { parseManifest: hostLibraries.parseYaml }),
    iframeRuntime: runtime.publicApi.iframeRuntime,
    openInspector,
    observe: (type, detail) => observability.record(type, detail),
    includeLegacy: () => settings.migrateLegacyJavascript,
});
messageController.install();
context.eventSource.on(context.event_types.GENERATION_ENDED, () => hostActions.clearEphemeral());

const secureHtmlRenderer = createSecureHtmlRenderer({
    document: globalThis.document,
    libraries: hostLibraries,
});
const secureHtmlController = createSecureHtmlController({
    document: globalThis.document,
    eventSource: context.eventSource,
    events: context.event_types,
    getChat: () => getContext().chat,
    settings,
    renderer: secureHtmlRenderer,
    formatMessage: (message, messageId) => messageFormatting(
        message.mes,
        message.is_user ? getContext().name1 : message.name,
        message.is_system,
        message.is_user,
        messageId,
    ),
    observe: (type, detail) => observability.record(type, detail),
});
secureHtmlController.install();

// Ember 3 remains the compatibility renderer while Ember 4 services are
// migrated behind the new runtime one feature at a time.
await import('./main.js');

runtime.markCompatibilityLoaded();

const settingsController = createSettingsController({
    document: globalThis.document,
    runtime: runtime.publicApi,
    settings,
    permissionPolicy,
    observability,
    secureHtmlController,
    persist: () => getContext().saveSettingsDebounced(),
    promptController,
});
for (let attempt = 0; attempt < 20 && !settingsController.install(); attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 250));
}
