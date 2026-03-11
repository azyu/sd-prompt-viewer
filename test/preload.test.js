const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

test('preload exposes metadata and ComfyUI parsing APIs', async () => {
    const electronModulePath = require.resolve('electron');
    const originalElectron = require.cache[electronModulePath];
    const preloadPath = path.resolve(__dirname, '../src/preload.js');

    let exposedApi = null;

    require.cache[electronModulePath] = {
        exports: {
            contextBridge: {
                exposeInMainWorld: (_key, api) => {
                    exposedApi = api;
                }
            }
        }
    };

    delete require.cache[preloadPath];
    require(preloadPath);

    assert.ok(exposedApi);
    assert.equal(typeof exposedApi.parseMetadata, 'function');
    assert.equal(typeof exposedApi.parseComfyTags, 'function');

    delete require.cache[preloadPath];

    if (originalElectron) {
        require.cache[electronModulePath] = originalElectron;
    } else {
        delete require.cache[electronModulePath];
    }
});
