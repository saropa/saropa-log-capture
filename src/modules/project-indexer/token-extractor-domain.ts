import { addNormalizedToken, collectTokens, MAX_TOKENS_PER_FILE } from './token-extractor-common';

/** Extract tokens from Firebase rules DSL. */
export function extractTokensFromRules(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);

    const pathRe = /match\s+\/([^/\s{][^{}\n]*)/g;
    let pathMatch: RegExpExecArray | null;
    while ((pathMatch = pathRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(pathMatch[1].replace(/\//g, ' '), set, MAX_TOKENS_PER_FILE);
    }

    const allowRe = /allow\s+([^:]+):/g;
    let allowMatch: RegExpExecArray | null;
    while ((allowMatch = allowRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(allowMatch[1], set, MAX_TOKENS_PER_FILE);
    }

    return [...set];
}

/** Extract tokens from XML/plist/manifest files: tags, attributes, and text content. */
export function extractTokensFromXml(content: string): string[] {
    const set = new Set<string>();
    const tagRe = /<([A-Za-z_][\w:.-]*)([^>]*)>/g;
    let tag: RegExpExecArray | null;
    while ((tag = tagRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(tag[1], set, MAX_TOKENS_PER_FILE);
        const attrs = tag[2];
        const attrRe = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
        let attr: RegExpExecArray | null;
        while ((attr = attrRe.exec(attrs)) !== null && set.size < MAX_TOKENS_PER_FILE) {
            collectTokens(attr[1], set, MAX_TOKENS_PER_FILE);
            collectTokens(attr[2], set, MAX_TOKENS_PER_FILE);
            addNormalizedToken(`${tag[1]}.${attr[1]}`, set, MAX_TOKENS_PER_FILE);
        }
    }
    const textOnly = content.replace(/<[^>]+>/g, ' ');
    collectTokens(textOnly, set, MAX_TOKENS_PER_FILE);
    return [...set];
}

/** Extract tokens from Gradle files with dependency-focused hints. */
export function extractTokensFromGradle(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);

    const quotedDepRe = /['"]([A-Za-z0-9._-]+:[A-Za-z0-9._-]+(?::[A-Za-z0-9+._-]+)?)['"]/g;
    let dep: RegExpExecArray | null;
    while ((dep = quotedDepRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        const coord = dep[1];
        collectTokens(coord.replace(/:/g, ' '), set, MAX_TOKENS_PER_FILE);
        addNormalizedToken(coord, set, MAX_TOKENS_PER_FILE);
    }

    const pluginRe = /id\s*\(\s*['"]([^'"]+)['"]\s*\)|id\s+['"]([^'"]+)['"]/g;
    let plugin: RegExpExecArray | null;
    while ((plugin = pluginRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        const id = plugin[1] ?? plugin[2] ?? '';
        if (!id) { continue; }
        collectTokens(id.replace(/\./g, ' '), set, MAX_TOKENS_PER_FILE);
        addNormalizedToken(id, set, MAX_TOKENS_PER_FILE);
    }

    return [...set];
}

/** Extract tokens from AsciiDoc/reStructuredText docs. */
export function extractTokensFromStructuredText(content: string): string[] {
    const set = new Set<string>();
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) { continue; }
        if (line.startsWith('=') || line.startsWith('==') || line.startsWith('===') || line.startsWith('====')) {
            collectTokens(line.replace(/^=+\s*/, ''), set, MAX_TOKENS_PER_FILE);
            continue;
        }
        if (i + 1 < lines.length) {
            const underline = lines[i + 1].trim();
            if (/^[-=~^`:#*]{3,}$/.test(underline)) {
                collectTokens(line, set, MAX_TOKENS_PER_FILE);
            }
        }
    }
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    return [...set];
}

/** Extract tokens from SQL files: generic tokens + table/entity hints. */
export function extractTokensFromSql(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const tablePatterns = [
        /\bfrom\s+([A-Za-z_][\w.]*)/gi,
        /\bjoin\s+([A-Za-z_][\w.]*)/gi,
        /\binto\s+([A-Za-z_][\w.]*)/gi,
        /\bupdate\s+([A-Za-z_][\w.]*)/gi,
        /\bcreate\s+table\s+([A-Za-z_][\w.]*)/gi,
    ];
    for (const pattern of tablePatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
            const table = match[1];
            collectTokens(table.replace(/\./g, ' '), set, MAX_TOKENS_PER_FILE);
            addNormalizedToken(table, set, MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}

/** Extract tokens from protobuf files: messages, services, RPC names, and imports. */
export function extractTokensFromProto(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const patterns = [
        /\bmessage\s+([A-Za-z_]\w*)/g,
        /\bservice\s+([A-Za-z_]\w*)/g,
        /\brpc\s+([A-Za-z_]\w*)/g,
        /\bimport\s+"([^"]+)"/g,
    ];
    for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
            collectTokens(match[1], set, MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}

/** Extract tokens from Dockerfiles: instructions, image names, and command strings. */
export function extractTokensFromDockerfile(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) { continue; }
        const from = line.match(/^FROM\s+([^\s]+)(?:\s+AS\s+([^\s]+))?/i);
        if (from) {
            collectTokens(from[1].replace(/[:/@]/g, ' '), set, MAX_TOKENS_PER_FILE);
            if (from[2]) { collectTokens(from[2], set, MAX_TOKENS_PER_FILE); }
            continue;
        }
        const instruction = line.match(/^([A-Z]+)\s+(.*)$/);
        if (instruction) {
            collectTokens(instruction[1], set, MAX_TOKENS_PER_FILE);
            collectTokens(instruction[2], set, MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}

/** Extract tokens from HCL/Terraform files. */
export function extractTokensFromHcl(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const blockRe = /(resource|data|module|provider|variable|output|terraform)\s+"([^"]+)"(?:\s+"([^"]+)")?/g;
    let block: RegExpExecArray | null;
    while ((block = blockRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(block[1], set, MAX_TOKENS_PER_FILE);
        collectTokens(block[2], set, MAX_TOKENS_PER_FILE);
        if (block[3]) { collectTokens(block[3], set, MAX_TOKENS_PER_FILE); }
    }
    return [...set];
}

/** Extract tokens from Python requirements-style dependency files. */
export function extractTokensFromRequirements(content: string): string[] {
    const set = new Set<string>();
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith('-r ') || line.startsWith('--')) { continue; }
        const pkgMatch = line.match(/^([A-Za-z0-9._-]+)/);
        if (pkgMatch) { collectTokens(pkgMatch[1], set, MAX_TOKENS_PER_FILE); }
        collectTokens(line, set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}

/** Extract tokens from Go module files. */
export function extractTokensFromGoMod(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const moduleRe = /^\s*module\s+([^\s]+)\s*$/gm;
    let moduleMatch: RegExpExecArray | null;
    while ((moduleMatch = moduleRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(moduleMatch[1], set, MAX_TOKENS_PER_FILE);
        addNormalizedToken(moduleMatch[1], set, MAX_TOKENS_PER_FILE);
    }
    const requireRe = /^\s*require\s+([^\s]+)\s+([^\s]+)\s*$/gm;
    let reqMatch: RegExpExecArray | null;
    while ((reqMatch = requireRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(reqMatch[1], set, MAX_TOKENS_PER_FILE);
        collectTokens(reqMatch[2], set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}

/** Extract tokens from Maven pom.xml with dependency-aware hints. */
export function extractTokensFromPomXml(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const depRe = /<dependency>[\s\S]*?<groupId>([^<]+)<\/groupId>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?(?:<version>([^<]+)<\/version>)?[\s\S]*?<\/dependency>/g;
    let dep: RegExpExecArray | null;
    while ((dep = depRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        const groupId = dep[1].trim();
        const artifactId = dep[2].trim();
        const version = dep[3]?.trim();
        collectTokens(groupId, set, MAX_TOKENS_PER_FILE);
        collectTokens(artifactId, set, MAX_TOKENS_PER_FILE);
        if (version) { collectTokens(version, set, MAX_TOKENS_PER_FILE); }
        addNormalizedToken(`${groupId}:${artifactId}${version ? `:${version}` : ''}`, set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}

/** Extract tokens from .sln and .NET project metadata files. */
export function extractTokensFromDotNetProject(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const pkgRe = /<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?/g;
    let pkg: RegExpExecArray | null;
    while ((pkg = pkgRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(pkg[1], set, MAX_TOKENS_PER_FILE);
        if (pkg[2]) { collectTokens(pkg[2], set, MAX_TOKENS_PER_FILE); }
    }
    return [...set];
}

/** Extract tokens from shell/build scripts (Makefile, .mk, .sh, .ps1). */
export function extractTokensFromScriptText(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const commandRe = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/gm; // Make targets
    let cmd: RegExpExecArray | null;
    while ((cmd = commandRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(cmd[1], set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}

/** Extract tokens from HTTP request files (.http/.rest). */
export function extractTokensFromHttpRequests(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    const reqRe = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/gmi;
    let req: RegExpExecArray | null;
    while ((req = reqRe.exec(content)) !== null && set.size < MAX_TOKENS_PER_FILE) {
        collectTokens(req[1], set, MAX_TOKENS_PER_FILE);
        collectTokens(req[2].replace(/[/?=&]/g, ' '), set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
