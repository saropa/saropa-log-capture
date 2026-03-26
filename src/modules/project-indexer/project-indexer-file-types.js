"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIND_FILES_EXCLUDE_GLOB = exports.DEFAULT_DOC_FILE_TYPES = void 0;
exports.normalizeDocFileTypes = normalizeDocFileTypes;
exports.buildRootPatternsForDocFileTypes = buildRootPatternsForDocFileTypes;
exports.matchesDocFileType = matchesDocFileType;
exports.isBlockedRelativePath = isBlockedRelativePath;
exports.extractDocTokensByType = extractDocTokensByType;
const token_extractor_1 = require("./token-extractor");
exports.DEFAULT_DOC_FILE_TYPES = [
    '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart',
    '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile',
    '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest',
    'makefile', 'requirements', 'pipfile',
];
exports.FIND_FILES_EXCLUDE_GLOB = '**/{node_modules,.dart_tool,build,dist,out,.git,vendor,__pycache__,target,.gradle,Pods,.pub-cache}/**';
const BLOCKED_FOLDER_NAMES = new Set([
    'node_modules',
    '.dart_tool',
    'build',
    'dist',
    'out',
    '.git',
    'vendor',
    '__pycache__',
    'target',
    '.gradle',
    'pods',
    '.pub-cache',
]);
function normalizeDocFileTypes(fileTypes) {
    return (fileTypes ?? exports.DEFAULT_DOC_FILE_TYPES).map((e) => {
        const lower = e.toLowerCase();
        if (lower === 'dockerfile') {
            return 'dockerfile';
        }
        return lower.startsWith('.') ? lower : `.${lower}`;
    });
}
function buildRootPatternsForDocFileTypes(fileTypes) {
    const patterns = new Set();
    for (const ft of fileTypes) {
        if (ft === 'dockerfile') {
            patterns.add('Dockerfile');
            patterns.add('Dockerfile.*');
            continue;
        }
        if (ft === 'makefile') {
            patterns.add('Makefile');
            continue;
        }
        if (ft === 'requirements') {
            patterns.add('requirements.txt');
            continue;
        }
        if (ft === 'pipfile') {
            patterns.add('Pipfile');
            patterns.add('Pipfile.lock');
            continue;
        }
        patterns.add(`*${ft}`);
    }
    return [...patterns];
}
function isDockerfilePath(lowerPath) {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'dockerfile' || file.startsWith('dockerfile.');
}
function hasEnvPrefix(lowerPath) {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === '.env' || file.startsWith('.env.');
}
function hasRequirementsName(lowerPath) {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'requirements.txt';
}
function hasPipfileName(lowerPath) {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'pipfile' || file === 'pipfile.lock';
}
function isMakefilePath(lowerPath) {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'makefile';
}
function matchesDocFileType(relativePath, fileTypes) {
    const lowerPath = relativePath.toLowerCase();
    const ext = lowerPath.includes('.') ? lowerPath.slice(lowerPath.lastIndexOf('.')) : '';
    if (fileTypes.includes(ext)) {
        return true;
    }
    if (fileTypes.includes('dockerfile') && isDockerfilePath(lowerPath)) {
        return true;
    }
    if (fileTypes.includes('.env') && hasEnvPrefix(lowerPath)) {
        return true;
    }
    if (fileTypes.includes('requirements') && hasRequirementsName(lowerPath)) {
        return true;
    }
    if (fileTypes.includes('pipfile') && hasPipfileName(lowerPath)) {
        return true;
    }
    if (fileTypes.includes('makefile') && isMakefilePath(lowerPath)) {
        return true;
    }
    return false;
}
function isBlockedRelativePath(relativePath) {
    const parts = relativePath.split('/').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
        if (BLOCKED_FOLDER_NAMES.has(part.toLowerCase())) {
            return true;
        }
    }
    return false;
}
function extractDocTokensByType(content, ext, lowerPath) {
    let tokens;
    let headings = [];
    const file = lowerPath.split('/').at(-1) ?? '';
    if (ext === '.md') {
        ({ tokens, headings } = (0, token_extractor_1.extractTokensFromMarkdown)(content));
    }
    else if (ext === '.arb') {
        tokens = (0, token_extractor_1.extractTokensFromArb)(content);
    }
    else if (ext === '.json') {
        tokens = (0, token_extractor_1.extractTokensFromJson)(content);
    }
    else if (ext === '.yaml' || ext === '.yml') {
        tokens = (0, token_extractor_1.extractTokensFromYaml)(content);
    }
    else if (ext === '.toml') {
        tokens = (0, token_extractor_1.extractTokensFromToml)(content);
    }
    else if (ext === '.rules') {
        tokens = (0, token_extractor_1.extractTokensFromRules)(content);
    }
    else if (ext === '.xml') {
        tokens = file === 'pom.xml' ? (0, token_extractor_1.extractTokensFromPomXml)(content) : (0, token_extractor_1.extractTokensFromXml)(content);
    }
    else if (ext === '.adoc' || ext === '.rst') {
        tokens = (0, token_extractor_1.extractTokensFromStructuredText)(content);
    }
    else if (ext === '.sql') {
        tokens = (0, token_extractor_1.extractTokensFromSql)(content);
    }
    else if (ext === '.proto') {
        tokens = (0, token_extractor_1.extractTokensFromProto)(content);
    }
    else if (ext === '.hcl' || ext === '.tf' || ext === '.tfvars') {
        tokens = (0, token_extractor_1.extractTokensFromHcl)(content);
    }
    else if (ext === '.mod' && file === 'go.mod') {
        tokens = (0, token_extractor_1.extractTokensFromGoMod)(content);
    }
    else if (ext === '.csproj' || ext === '.sln' || ext === '.props' || ext === '.targets') {
        tokens = (0, token_extractor_1.extractTokensFromDotNetProject)(content);
    }
    else if (ext === '.http' || ext === '.rest') {
        tokens = (0, token_extractor_1.extractTokensFromHttpRequests)(content);
    }
    else if (ext === '.mk' || ext === '.sh' || ext === '.ps1' || file === 'makefile') {
        tokens = (0, token_extractor_1.extractTokensFromScriptText)(content);
    }
    else if (file === 'requirements.txt') {
        tokens = (0, token_extractor_1.extractTokensFromRequirements)(content);
    }
    else if (file === 'pipfile') {
        tokens = (0, token_extractor_1.extractTokensFromToml)(content);
    }
    else if (file === 'pipfile.lock') {
        tokens = (0, token_extractor_1.extractTokensFromJson)(content);
    }
    else if (ext === '.ini' || ext === '.cfg' || ext === '.conf' || ext === '.properties' || hasEnvPrefix(lowerPath)) {
        tokens = (0, token_extractor_1.extractTokensFromKeyValueText)(content);
    }
    else if (isDockerfilePath(lowerPath)) {
        tokens = (0, token_extractor_1.extractTokensFromDockerfile)(content);
    }
    else if (lowerPath.endsWith('.gradle') || lowerPath.endsWith('.gradle.kts')) {
        tokens = (0, token_extractor_1.extractTokensFromGradle)(content);
    }
    else {
        tokens = (0, token_extractor_1.extractTokensFromText)(content);
    }
    return { tokens, headings };
}
//# sourceMappingURL=project-indexer-file-types.js.map