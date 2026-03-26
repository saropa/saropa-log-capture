"use strict";
/**
 * Public token extractor API.
 * Implementations are split by format in sibling modules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTokensFromXml = exports.extractTokensFromGoMod = exports.extractTokensFromStructuredText = exports.extractTokensFromSql = exports.extractTokensFromScriptText = exports.extractTokensFromRules = exports.extractTokensFromRequirements = exports.extractTokensFromProto = exports.extractTokensFromPomXml = exports.extractTokensFromHttpRequests = exports.extractTokensFromHcl = exports.extractTokensFromGradle = exports.extractTokensFromDotNetProject = exports.extractTokensFromDockerfile = exports.extractTokensFromYaml = exports.extractTokensFromToml = exports.extractTokensFromKeyValueText = exports.extractTokensFromJson = exports.extractTokensFromArb = exports.extractTokensFromMarkdown = exports.extractHeadings = void 0;
exports.extractTokensFromText = extractTokensFromText;
const token_extractor_common_1 = require("./token-extractor-common");
var token_extractor_markdown_1 = require("./token-extractor-markdown");
Object.defineProperty(exports, "extractHeadings", { enumerable: true, get: function () { return token_extractor_markdown_1.extractHeadings; } });
Object.defineProperty(exports, "extractTokensFromMarkdown", { enumerable: true, get: function () { return token_extractor_markdown_1.extractTokensFromMarkdown; } });
var token_extractor_config_1 = require("./token-extractor-config");
Object.defineProperty(exports, "extractTokensFromArb", { enumerable: true, get: function () { return token_extractor_config_1.extractTokensFromArb; } });
Object.defineProperty(exports, "extractTokensFromJson", { enumerable: true, get: function () { return token_extractor_config_1.extractTokensFromJson; } });
Object.defineProperty(exports, "extractTokensFromKeyValueText", { enumerable: true, get: function () { return token_extractor_config_1.extractTokensFromKeyValueText; } });
Object.defineProperty(exports, "extractTokensFromToml", { enumerable: true, get: function () { return token_extractor_config_1.extractTokensFromToml; } });
Object.defineProperty(exports, "extractTokensFromYaml", { enumerable: true, get: function () { return token_extractor_config_1.extractTokensFromYaml; } });
var token_extractor_domain_1 = require("./token-extractor-domain");
Object.defineProperty(exports, "extractTokensFromDockerfile", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromDockerfile; } });
Object.defineProperty(exports, "extractTokensFromDotNetProject", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromDotNetProject; } });
Object.defineProperty(exports, "extractTokensFromGradle", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromGradle; } });
Object.defineProperty(exports, "extractTokensFromHcl", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromHcl; } });
Object.defineProperty(exports, "extractTokensFromHttpRequests", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromHttpRequests; } });
Object.defineProperty(exports, "extractTokensFromPomXml", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromPomXml; } });
Object.defineProperty(exports, "extractTokensFromProto", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromProto; } });
Object.defineProperty(exports, "extractTokensFromRequirements", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromRequirements; } });
Object.defineProperty(exports, "extractTokensFromRules", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromRules; } });
Object.defineProperty(exports, "extractTokensFromScriptText", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromScriptText; } });
Object.defineProperty(exports, "extractTokensFromSql", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromSql; } });
Object.defineProperty(exports, "extractTokensFromStructuredText", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromStructuredText; } });
Object.defineProperty(exports, "extractTokensFromGoMod", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromGoMod; } });
Object.defineProperty(exports, "extractTokensFromXml", { enumerable: true, get: function () { return token_extractor_domain_1.extractTokensFromXml; } });
/** Extract tokens from plain text (e.g. .txt). */
function extractTokensFromText(content) {
    const set = new Set();
    (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    return [...set];
}
//# sourceMappingURL=token-extractor.js.map