(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.comfyParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    function sanitizeJsonLikeString(text) {
        let sanitized = '';
        let inString = false;
        let escaped = false;

        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];

            if (escaped) {
                sanitized += char;
                escaped = false;
                continue;
            }

            if (char === '\\') {
                sanitized += char;
                escaped = true;
                continue;
            }

            if (char === '"') {
                sanitized += char;
                inString = !inString;
                continue;
            }

            if (!inString && text.startsWith('NaN', index)) {
                sanitized += 'null';
                index += 2;
                continue;
            }

            sanitized += char;
        }

        return sanitized;
    }

    function parseJsonTag(tag) {
        if (!tag || typeof tag.description !== 'string') return null;

        try {
            return JSON.parse(sanitizeJsonLikeString(tag.description));
        } catch (error) {
            console.error('Failed to parse ComfyUI JSON', error);
            return null;
        }
    }

    function parseComfyTags(tags) {
        const promptJson = parseJsonTag(tags && tags.prompt);
        const workflowJson = parseJsonTag(tags && tags.workflow);

        let posRendered = new Set();
        let posSource = new Set();
        let negRendered = new Set();
        let negSource = new Set();

        let seed = 'Unknown';
        let steps = 'Unknown';
        let cfg = 'Unknown';
        let sampler = 'Unknown';
        let model = 'Unknown';

        if (promptJson) {
            const nodes = promptJson;

            const collectText = (inputVal, targetRendered, targetSource, direction, visited = new Set()) => {
                if (!Array.isArray(inputVal)) return false;

                const linkNodeId = String(inputVal[0]);
                if (visited.has(linkNodeId)) return false;
                visited.add(linkNodeId);

                const linkNode = nodes[linkNodeId];
                if (!linkNode || !linkNode.inputs) return false;

                const populatedText = linkNode.inputs.populated_text;
                const hasPopulatedText = typeof populatedText === 'string' && populatedText.trim();
                let foundText = false;

                if (hasPopulatedText) {
                    targetRendered.add(populatedText.trim());
                    foundText = true;
                }

                const linkedLabels = ['text', 'text_g', 'text_l', 'wildcard_text', 'wildcard', 'populated_text', 'prompt'];
                linkedLabels.forEach((label) => {
                    if (Array.isArray(linkNode.inputs[label])) {
                        if (collectText(linkNode.inputs[label], targetRendered, targetSource, direction, visited)) {
                            foundText = true;
                        }
                    }
                });

                let nextInputs = ['conditioning', 'conditioning_1', 'conditioning_2', 'conditioning_from', 'conditioning_to', 'source'];

                if (direction === 'positive') nextInputs.push('positive', 'a', 'base_ctx', 'refiner_ctx', 'refiner_positive', 'clip');
                if (direction === 'negative') nextInputs.push('negative', 'b', 'refiner_negative', 'clip');

                nextInputs.push('bus', 'pipe', 'basic_pipe');

                let continued = false;
                nextInputs.forEach((key) => {
                    if (linkNode.inputs[key]) {
                        continued = true;
                        if (collectText(linkNode.inputs[key], targetRendered, targetSource, direction, visited)) {
                            foundText = true;
                        }
                    }
                });

                if (!continued) {
                    const type = linkNode.class_type || '';
                    if (type === 'Reroute' || type === 'Note' || type.includes('Reroute')) {
                        Object.values(linkNode.inputs).forEach((value) => {
                            if (collectText(value, targetRendered, targetSource, direction, visited)) {
                                foundText = true;
                            }
                        });
                    }
                }

                if (foundText) return true;

                // Some custom nodes output prompt text without using CLIPTextEncode.
                const sourceInputs = [
                    linkNode.inputs.text,
                    linkNode.inputs.text_g,
                    linkNode.inputs.text_l,
                    linkNode.inputs.string_field,
                    linkNode.inputs.prompt,
                    linkNode.inputs.wildcard,
                    linkNode.inputs.wildcard_text
                ];

                sourceInputs.forEach((value) => {
                    if (typeof value === 'string' && value.trim()) {
                        targetSource.add(value.trim());
                        if (!hasPopulatedText) {
                            targetRendered.add(value.trim());
                        }
                        foundText = true;
                    }
                });

                return foundText;
            };

            Object.values(nodes).forEach((node) => {
                if (node.class_type && node.class_type.includes('KSampler')) {
                    if (node.inputs.seed) seed = node.inputs.seed;
                    if (node.inputs.steps) steps = node.inputs.steps;
                    if (node.inputs.cfg) cfg = node.inputs.cfg;
                    if (node.inputs.sampler_name) sampler = node.inputs.sampler_name;

                    if (node.inputs.positive) {
                        collectText(node.inputs.positive, posRendered, posSource, 'positive');
                    }
                    if (node.inputs.negative) {
                        collectText(node.inputs.negative, negRendered, negSource, 'negative');
                    }
                }

                if (node.class_type === 'CheckpointLoaderSimple' || node.class_type === 'CheckpointLoader') {
                    if (node.inputs.ckpt_name) model = node.inputs.ckpt_name;
                }
            });
        }

        return {
            rawData: JSON.stringify(workflowJson || promptJson, null, 2),
            promptData: {
                positive: {
                    rendered: Array.from(posRendered).join('\n\n') || 'No Positive Prompt Found',
                    source: Array.from(posSource).join('\n\n') || 'No Source Prompt Found'
                },
                negative: {
                    rendered: Array.from(negRendered).join('\n\n'),
                    source: Array.from(negSource).join('\n\n')
                }
            },
            attributes: {
                seed,
                steps,
                cfg,
                sampler,
                model
            }
        };
    }

    return { parseComfyTags };
});
