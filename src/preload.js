const { contextBridge } = require('electron');
const ExifReader = require('exifreader');
const { parseComfyTags } = require('./comfy-parser');

contextBridge.exposeInMainWorld('electronAPI', {
    parseMetadata: async (arrayBuffer) => {
        try {
            // ExifReader.load returns an object with tags
            const tags = ExifReader.load(arrayBuffer);
            return tags;
        } catch (e) {
            console.error('Metadata parsing error:', e);
            return null;
        }
    },
    parseComfyTags: (tags) => parseComfyTags(tags)
});
