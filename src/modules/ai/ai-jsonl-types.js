"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolNameToCategory = toolNameToCategory;
exports.isMutationTool = isMutationTool;
/** Map tool names to viewer categories. */
function toolNameToCategory(toolName) {
    switch (toolName) {
        case 'Write':
        case 'Edit':
        case 'NotebookEdit':
            return 'ai-edit';
        case 'Bash':
            return 'ai-bash';
        case 'Read':
        case 'Grep':
        case 'Glob':
        case 'WebFetch':
        case 'WebSearch':
            return 'ai-read';
        default:
            return 'ai-read';
    }
}
/** Mutation tools that modify files or run commands. */
const mutationTools = new Set(['Write', 'Edit', 'NotebookEdit', 'Bash']);
/** Check whether a tool name represents a mutation (file write or command execution). */
function isMutationTool(toolName) {
    return mutationTools.has(toolName);
}
//# sourceMappingURL=ai-jsonl-types.js.map