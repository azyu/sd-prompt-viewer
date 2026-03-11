const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('raw metadata panel is visible by default', () => {
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');

    assert.match(indexHtml, /class="field-group full-raw"/);
    assert.doesNotMatch(indexHtml, /<div class="field-group full-raw hidden">/);
});
