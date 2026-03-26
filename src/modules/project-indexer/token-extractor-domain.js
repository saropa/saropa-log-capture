"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTokensFromRules = extractTokensFromRules;
exports.extractTokensFromXml = extractTokensFromXml;
exports.extractTokensFromGradle = extractTokensFromGradle;
exports.extractTokensFromStructuredText = extractTokensFromStructuredText;
exports.extractTokensFromSql = extractTokensFromSql;
exports.extractTokensFromProto = extractTokensFromProto;
exports.extractTokensFromDockerfile = extractTokensFromDockerfile;
exports.extractTokensFromHcl = extractTokensFromHcl;
exports.extractTokensFromRequirements = extractTokensFromRequirements;
exports.extractTokensFromGoMod = extractTokensFromGoMod;
exports.extractTokensFromPomXml = extractTokensFromPomXml;
exports.extractTokensFromDotNetProject = extractTokensFromDotNetProject;
exports.extractTokensFromScriptText = extractTokensFromScriptText;
exports.extractTokensFromHttpRequests = extractTokensFromHttpRequests;
const token_extractor_common_1 = require("./token-extractor-common");
/** Extract tokens from Firebase rules DSL. */
function extractTokensFromRules(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const pathRe = /match\s+\/([^/\s{][^{}\n]*)/g;
    let pathMatch;
    while ((pathMatch = pathRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(pathMatch[1].replace(/\//g, ' '), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    const allowRe = /allow\s+([^:]+):/g;
    let allowMatch;
    while ((allowMatch = allowRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(allowMatch[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from XML/plist/manifest files: tags, attributes, and text content. */
function extractTokensFromXml(content) {
    const set = new Set();
    const tagRe = /<([A-Za-z_][\w:.-]*)([^>]*)>/g;
    let tag;
    while ((tag = tagRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(tag[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        const attrs = tag[2];
        const attrRe = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
        let attr;
        while ((attr = attrRe.exec(attrs)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
            (0, token_extractor_common_1.collectTokens)(attr[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            (0, token_extractor_common_1.collectTokens)(attr[2], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            (0, token_extractor_common_1.addNormalizedToken)(`${tag[1]}.${attr[1]}`, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
    }
    const textOnly = content.replace(/<[^>]+>/g, ' ');
    (0, token_extractor_common_1.collectTokens)(textOnly, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    return [...set];
}
/** Extract tokens from Gradle files with dependency-focused hints. */
function extractTokensFromGradle(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const quotedDepRe = /['"]([A-Za-z0-9._-]+:[A-Za-z0-9._-]+(?::[A-Za-z0-9+._-]+)?)['"]/g;
    let dep;
    while ((dep = quotedDepRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        const coord = dep[1];
        (0, token_extractor_common_1.collectTokens)(coord.replace(/:/g, ' '), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.addNormalizedToken)(coord, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    const pluginRe = /id\s*\(\s*['"]([^'"]+)['"]\s*\)|id\s+['"]([^'"]+)['"]/g;
    let plugin;
    while ((plugin = pluginRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        const id = plugin[1] ?? plugin[2] ?? '';
        if (!id) {
            continue;
        }
        (0, token_extractor_common_1.collectTokens)(id.replace(/\./g, ' '), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.addNormalizedToken)(id, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from AsciiDoc/reStructuredText docs. */
function extractTokensFromStructuredText(content) {
    const set = new Set();
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            continue;
        }
        if (line.startsWith('=') || line.startsWith('==') || line.startsWith('===') || line.startsWith('====')) {
            (0, token_extractor_common_1.collectTokens)(line.replace(/^=+\s*/, ''), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            continue;
        }
        if (i + 1 < lines.length) {
            const underline = lines[i + 1].trim();
            if (/^[-=~^`:#*]{3,}$/.test(underline)) {
                (0, token_extractor_common_1.collectTokens)(line, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            }
        }
    }
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    return [...set];
}
/** Extract tokens from SQL files: generic tokens + table/entity hints. */
function extractTokensFromSql(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const tablePatterns = [
        /\bfrom\s+([A-Za-z_][\w.]*)/gi,
        /\bjoin\s+([A-Za-z_][\w.]*)/gi,
        /\binto\s+([A-Za-z_][\w.]*)/gi,
        /\bupdate\s+([A-Za-z_][\w.]*)/gi,
        /\bcreate\s+table\s+([A-Za-z_][\w.]*)/gi,
    ];
    for (const pattern of tablePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
            const table = match[1];
            (0, token_extractor_common_1.collectTokens)(table.replace(/\./g, ' '), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            (0, token_extractor_common_1.addNormalizedToken)(table, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}
/** Extract tokens from protobuf files: messages, services, RPC names, and imports. */
function extractTokensFromProto(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const patterns = [
        /\bmessage\s+([A-Za-z_]\w*)/g,
        /\bservice\s+([A-Za-z_]\w*)/g,
        /\brpc\s+([A-Za-z_]\w*)/g,
        /\bimport\s+"([^"]+)"/g,
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
            (0, token_extractor_common_1.collectTokens)(match[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}
/** Extract tokens from Dockerfiles: instructions, image names, and command strings. */
function extractTokensFromDockerfile(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const from = line.match(/^FROM\s+([^\s]+)(?:\s+AS\s+([^\s]+))?/i);
        if (from) {
            (0, token_extractor_common_1.collectTokens)(from[1].replace(/[:/@]/g, ' '), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            if (from[2]) {
                (0, token_extractor_common_1.collectTokens)(from[2], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            }
            continue;
        }
        const instruction = line.match(/^([A-Z]+)\s+(.*)$/);
        if (instruction) {
            (0, token_extractor_common_1.collectTokens)(instruction[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            (0, token_extractor_common_1.collectTokens)(instruction[2], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}
/** Extract tokens from HCL/Terraform files. */
function extractTokensFromHcl(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const blockRe = /(resource|data|module|provider|variable|output|terraform)\s+"([^"]+)"(?:\s+"([^"]+)")?/g;
    let block;
    while ((block = blockRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(block[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.collectTokens)(block[2], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        if (block[3]) {
            (0, token_extractor_common_1.collectTokens)(block[3], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}
/** Extract tokens from Python requirements-style dependency files. */
function extractTokensFromRequirements(content) {
    const set = new Set();
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith('-r ') || line.startsWith('--')) {
            continue;
        }
        const pkgMatch = line.match(/^([A-Za-z0-9._-]+)/);
        if (pkgMatch) {
            (0, token_extractor_common_1.collectTokens)(pkgMatch[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
        (0, token_extractor_common_1.collectTokens)(line, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from Go module files. */
function extractTokensFromGoMod(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const moduleRe = /^\s*module\s+([^\s]+)\s*$/gm;
    let moduleMatch;
    while ((moduleMatch = moduleRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(moduleMatch[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.addNormalizedToken)(moduleMatch[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    const requireRe = /^\s*require\s+([^\s]+)\s+([^\s]+)\s*$/gm;
    let reqMatch;
    while ((reqMatch = requireRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(reqMatch[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.collectTokens)(reqMatch[2], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from Maven pom.xml with dependency-aware hints. */
function extractTokensFromPomXml(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const depRe = /<dependency>[\s\S]*?<groupId>([^<]+)<\/groupId>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?(?:<version>([^<]+)<\/version>)?[\s\S]*?<\/dependency>/g;
    let dep;
    while ((dep = depRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        const groupId = dep[1].trim();
        const artifactId = dep[2].trim();
        const version = dep[3]?.trim();
        (0, token_extractor_common_1.collectTokens)(groupId, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.collectTokens)(artifactId, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        if (version) {
            (0, token_extractor_common_1.collectTokens)(version, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
        (0, token_extractor_common_1.addNormalizedToken)(`${groupId}:${artifactId}${version ? `:${version}` : ''}`, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from .sln and .NET project metadata files. */
function extractTokensFromDotNetProject(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const pkgRe = /<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?/g;
    let pkg;
    while ((pkg = pkgRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(pkg[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        if (pkg[2]) {
            (0, token_extractor_common_1.collectTokens)(pkg[2], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}
/** Extract tokens from shell/build scripts (Makefile, .mk, .sh, .ps1). */
function extractTokensFromScriptText(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const commandRe = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/gm; // Make targets
    let cmd;
    while ((cmd = commandRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(cmd[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from HTTP request files (.http/.rest). */
function extractTokensFromHttpRequests(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    const reqRe = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/gmi;
    let req;
    while ((req = reqRe.exec(content)) !== null && set.size < token_extractor_common_1.MAX_TOKENS_PER_FILE) {
        (0, token_extractor_common_1.collectTokens)(req[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.collectTokens)(req[2].replace(/[/?=&]/g, ' '), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
//# sourceMappingURL=token-extractor-domain.js.map