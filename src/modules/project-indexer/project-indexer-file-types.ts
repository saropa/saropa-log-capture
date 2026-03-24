import {
    extractTokensFromArb,
    extractTokensFromDockerfile,
    extractTokensFromDotNetProject,
    extractTokensFromGradle,
    extractTokensFromGoMod,
    extractTokensFromHcl,
    extractTokensFromHttpRequests,
    extractTokensFromJson,
    extractTokensFromKeyValueText,
    extractTokensFromMarkdown,
    extractTokensFromPomXml,
    extractTokensFromProto,
    extractTokensFromRequirements,
    extractTokensFromRules,
    extractTokensFromScriptText,
    extractTokensFromSql,
    extractTokensFromStructuredText,
    extractTokensFromText,
    extractTokensFromToml,
    extractTokensFromXml,
    extractTokensFromYaml,
} from './token-extractor';

export const DEFAULT_DOC_FILE_TYPES = [
    '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart',
    '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile',
    '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest',
    'makefile', 'requirements', 'pipfile',
] as const;

export const FIND_FILES_EXCLUDE_GLOB = '**/{node_modules,.dart_tool,build,dist,out,.git,vendor,__pycache__,target,.gradle,Pods,.pub-cache}/**';

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

export function normalizeDocFileTypes(fileTypes: readonly string[] | undefined): string[] {
    return (fileTypes ?? DEFAULT_DOC_FILE_TYPES).map((e) => {
        const lower = e.toLowerCase();
        if (lower === 'dockerfile') { return 'dockerfile'; }
        return lower.startsWith('.') ? lower : `.${lower}`;
    });
}

export function buildRootPatternsForDocFileTypes(fileTypes: readonly string[]): string[] {
    const patterns = new Set<string>();
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

function isDockerfilePath(lowerPath: string): boolean {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'dockerfile' || file.startsWith('dockerfile.');
}

function hasEnvPrefix(lowerPath: string): boolean {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === '.env' || file.startsWith('.env.');
}

function hasRequirementsName(lowerPath: string): boolean {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'requirements.txt';
}

function hasPipfileName(lowerPath: string): boolean {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'pipfile' || file === 'pipfile.lock';
}

function isMakefilePath(lowerPath: string): boolean {
    const file = lowerPath.split('/').at(-1) ?? '';
    return file === 'makefile';
}

export function matchesDocFileType(relativePath: string, fileTypes: readonly string[]): boolean {
    const lowerPath = relativePath.toLowerCase();
    const ext = lowerPath.includes('.') ? lowerPath.slice(lowerPath.lastIndexOf('.')) : '';
    if (fileTypes.includes(ext)) { return true; }
    if (fileTypes.includes('dockerfile') && isDockerfilePath(lowerPath)) { return true; }
    if (fileTypes.includes('.env') && hasEnvPrefix(lowerPath)) { return true; }
    if (fileTypes.includes('requirements') && hasRequirementsName(lowerPath)) { return true; }
    if (fileTypes.includes('pipfile') && hasPipfileName(lowerPath)) { return true; }
    if (fileTypes.includes('makefile') && isMakefilePath(lowerPath)) { return true; }
    return false;
}

export function isBlockedRelativePath(relativePath: string): boolean {
    const parts = relativePath.split('/').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
        if (BLOCKED_FOLDER_NAMES.has(part.toLowerCase())) { return true; }
    }
    return false;
}

export function extractDocTokensByType(
    content: string,
    ext: string,
    lowerPath: string,
): { tokens: string[]; headings: ReturnType<typeof extractTokensFromMarkdown>['headings'] } {
    let tokens: string[];
    let headings: ReturnType<typeof extractTokensFromMarkdown>['headings'] = [];
    const file = lowerPath.split('/').at(-1) ?? '';
    if (ext === '.md') {
        ({ tokens, headings } = extractTokensFromMarkdown(content));
    } else if (ext === '.arb') {
        tokens = extractTokensFromArb(content);
    } else if (ext === '.json') {
        tokens = extractTokensFromJson(content);
    } else if (ext === '.yaml' || ext === '.yml') {
        tokens = extractTokensFromYaml(content);
    } else if (ext === '.toml') {
        tokens = extractTokensFromToml(content);
    } else if (ext === '.rules') {
        tokens = extractTokensFromRules(content);
    } else if (ext === '.xml') {
        tokens = file === 'pom.xml' ? extractTokensFromPomXml(content) : extractTokensFromXml(content);
    } else if (ext === '.adoc' || ext === '.rst') {
        tokens = extractTokensFromStructuredText(content);
    } else if (ext === '.sql') {
        tokens = extractTokensFromSql(content);
    } else if (ext === '.proto') {
        tokens = extractTokensFromProto(content);
    } else if (ext === '.hcl' || ext === '.tf' || ext === '.tfvars') {
        tokens = extractTokensFromHcl(content);
    } else if (ext === '.mod' && file === 'go.mod') {
        tokens = extractTokensFromGoMod(content);
    } else if (ext === '.csproj' || ext === '.sln' || ext === '.props' || ext === '.targets') {
        tokens = extractTokensFromDotNetProject(content);
    } else if (ext === '.http' || ext === '.rest') {
        tokens = extractTokensFromHttpRequests(content);
    } else if (ext === '.mk' || ext === '.sh' || ext === '.ps1' || file === 'makefile') {
        tokens = extractTokensFromScriptText(content);
    } else if (file === 'requirements.txt') {
        tokens = extractTokensFromRequirements(content);
    } else if (file === 'pipfile') {
        tokens = extractTokensFromToml(content);
    } else if (file === 'pipfile.lock') {
        tokens = extractTokensFromJson(content);
    } else if (ext === '.ini' || ext === '.cfg' || ext === '.conf' || ext === '.properties' || hasEnvPrefix(lowerPath)) {
        tokens = extractTokensFromKeyValueText(content);
    } else if (isDockerfilePath(lowerPath)) {
        tokens = extractTokensFromDockerfile(content);
    } else if (lowerPath.endsWith('.gradle') || lowerPath.endsWith('.gradle.kts')) {
        tokens = extractTokensFromGradle(content);
    } else {
        tokens = extractTokensFromText(content);
    }
    return { tokens, headings };
}
