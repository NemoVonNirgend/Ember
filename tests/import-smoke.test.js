import test from 'node:test';
import assert from 'node:assert/strict';

test('foundation modules import without a browser DOM', async () => {
    const modules = await Promise.all([
        import('../src/core/runtime.js'),
        import('../src/core/artifact-registry.js'),
        import('../src/core/permissions.js'),
        import('../src/parser/artifact-parser.js'),
        import('../src/bridge/protocol.js'),
        import('../src/libraries/host-library-catalog.js'),
        import('../src/runtime/artifact-session-store.js'),
        import('../src/runtime/frame-document.js'),
        import('../src/runtime/iframe-runtime.js'),
        import('../src/bridge/message-router.js'),
        import('../src/core/permission-policy.js'),
        import('../src/integration/artifact-state-store.js'),
        import('../src/integration/sillytavern-host-actions.js'),
        import('../src/integration/message-controller.js'),
        import('../src/libraries/trusted-host-libraries.js'),
        import('../src/observability/observability-service.js'),
        import('../src/ui/permission-dialog.js'),
        import('../src/ui/artifact-inspector.js'),
        import('../src/ui/settings-controller.js'),
        import('../src/html/secure-html-analyzer.js'),
        import('../src/html/secure-html-renderer.js'),
        import('../src/html/secure-html-controller.js'),
        import('../src/prompt/artifact-prompt.js'),
        import('../src/diagnostics/artifact-diagnostics.js'),
        import('../src/repair/repair-preview-service.js'),
        import('../src/repair/model-repair-service.js'),
        import('../src/libraries/artifact-library-registry.js'),
        import('../src/repair/repair-application-service.js'),
        import('../src/integration/network-broker.js'),
        import('../src/artifacts/artifact-package.js'),
        import('../src/integration/artifact-library-store.js'),
        import('../src/integration/browser-artifact-io.js'),
    ]);
    assert.equal(modules.length, 32);
});
