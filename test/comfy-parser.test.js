const test = require('node:test');
const assert = require('node:assert/strict');

const { parseComfyTags } = require('../src/comfy-parser');

test('extracts prompts and sampler attributes from standard ComfyUI nodes', () => {
    const tags = {
        prompt: {
            description: JSON.stringify({
                3: {
                    inputs: {
                        seed: 123,
                        steps: 30,
                        cfg: 7,
                        sampler_name: 'euler',
                        model: ['4', 0],
                        positive: ['6', 0],
                        negative: ['7', 0]
                    },
                    class_type: 'KSampler'
                },
                4: {
                    inputs: { ckpt_name: 'model.safetensors' },
                    class_type: 'CheckpointLoaderSimple'
                },
                6: {
                    inputs: { text: 'positive prompt', clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                },
                7: {
                    inputs: { text: 'negative prompt', clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                }
            })
        }
    };

    const result = parseComfyTags(tags);

    assert.equal(result.promptData.positive.rendered, 'positive prompt');
    assert.equal(result.promptData.positive.source, 'positive prompt');
    assert.equal(result.promptData.negative.rendered, 'negative prompt');
    assert.equal(result.promptData.negative.source, 'negative prompt');
    assert.deepEqual(result.attributes, {
        seed: 123,
        steps: 30,
        cfg: 7,
        sampler: 'euler',
        model: 'model.safetensors'
    });
});

test('extracts positive prompt text from linked custom string nodes', () => {
    const tags = {
        prompt: {
            description: JSON.stringify({
                3: {
                    inputs: {
                        seed: 348776292763975,
                        steps: 20,
                        cfg: 6,
                        sampler_name: 'euler',
                        model: ['4', 0],
                        positive: ['6', 0],
                        negative: ['7', 0]
                    },
                    class_type: 'KSampler'
                },
                4: {
                    inputs: { ckpt_name: 'novaAnimeXL_ilV170.safetensors' },
                    class_type: 'CheckpointLoaderSimple'
                },
                6: {
                    inputs: { text: ['27', 0], clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                },
                7: {
                    inputs: { text: 'negative prompt', clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                },
                27: {
                    inputs: {
                        text: 'template prompt from random generator',
                        seed: 773,
                        autorefresh: 'No'
                    },
                    class_type: 'StringNode'
                }
            })
        }
    };

    const result = parseComfyTags(tags);

    assert.equal(result.promptData.positive.rendered, 'template prompt from random generator');
    assert.equal(result.promptData.positive.source, 'template prompt from random generator');
    assert.equal(result.promptData.negative.rendered, 'negative prompt');
    assert.equal(result.attributes.model, 'novaAnimeXL_ilV170.safetensors');
});

test('does not pretend rendered prompt exists when metadata only stores a dynamic source template', () => {
    const tags = {
        prompt: {
            description: JSON.stringify({
                3: {
                    inputs: {
                        seed: 348776292763975,
                        steps: 20,
                        cfg: 6,
                        sampler_name: 'euler',
                        model: ['4', 0],
                        positive: ['6', 0],
                        negative: ['7', 0]
                    },
                    class_type: 'KSampler'
                },
                4: {
                    inputs: { ckpt_name: 'novaAnimeXL_ilV170.safetensors' },
                    class_type: 'CheckpointLoaderSimple'
                },
                6: {
                    inputs: { text: ['27', 0], clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                },
                7: {
                    inputs: { text: 'negative prompt', clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                },
                27: {
                    inputs: {
                        text: '1girl, {long|short} hair, __hair_color__',
                        seed: 773,
                        autorefresh: 'No'
                    },
                    class_type: 'DPRandomGenerator'
                }
            })
        }
    };

    const result = parseComfyTags(tags);

    assert.equal(result.promptData.positive.rendered, 'Rendered prompt not available in metadata');
    assert.equal(result.promptData.positive.source, '1girl, {long|short} hair, __hair_color__');
    assert.notEqual(result.promptData.positive.rendered, result.promptData.positive.source);
});

test('ignores helper node text fields and continues to the linked prompt source', () => {
    const tags = {
        prompt: {
            description: JSON.stringify({
                3: {
                    inputs: {
                        seed: 99,
                        steps: 28,
                        cfg: 5.5,
                        sampler_name: 'dpmpp_2m',
                        model: ['4', 0],
                        positive: ['8', 0],
                        negative: ['7', 0]
                    },
                    class_type: 'KSampler'
                },
                4: {
                    inputs: { ckpt_name: 'model.safetensors' },
                    class_type: 'CheckpointLoaderSimple'
                },
                6: {
                    inputs: { text: ['27', 0], clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                },
                7: {
                    inputs: { text: 'negative prompt', clip: ['4', 1] },
                    class_type: 'CLIPTextEncode'
                },
                8: {
                    inputs: {
                        text: 'helper label that is not the prompt',
                        conditioning: ['6', 0]
                    },
                    class_type: 'ConditioningHelper'
                },
                27: {
                    inputs: { text: 'actual prompt text' },
                    class_type: 'DPRandomGenerator'
                }
            })
        }
    };

    const result = parseComfyTags(tags);

    assert.equal(result.promptData.positive.rendered, 'actual prompt text');
    assert.equal(result.promptData.positive.source, 'actual prompt text');
});

test('parses prompt tags that include NaN in ComfyUI metadata', () => {
    const tags = {
        prompt: {
            description: '{"3":{"inputs":{"seed":1,"steps":20,"cfg":6,"sampler_name":"euler","model":["4",0],"positive":["6",0],"negative":["7",0]},"class_type":"KSampler"},"4":{"inputs":{"ckpt_name":"model.safetensors"},"class_type":"CheckpointLoaderSimple"},"6":{"inputs":{"text":["27",0],"clip":["4",1]},"class_type":"CLIPTextEncode"},"7":{"inputs":{"text":"negative prompt","clip":["4",1]},"class_type":"CLIPTextEncode"},"27":{"inputs":{"text":"template prompt from random generator"},"class_type":"DPRandomGenerator","is_changed":[NaN]}}'
        }
    };

    const result = parseComfyTags(tags);

    assert.equal(result.promptData.positive.rendered, 'template prompt from random generator');
    assert.equal(result.attributes.seed, 1);
});
