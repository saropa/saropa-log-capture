/**
 * Public token extractor API.
 * Implementations are split by format in sibling modules.
 */

import { collectTokens, MAX_TOKENS_PER_FILE } from './token-extractor-common';

export { HeadingEntry, extractHeadings, extractTokensFromMarkdown } from './token-extractor-markdown';
export {
    extractTokensFromArb,
    extractTokensFromJson,
    extractTokensFromKeyValueText,
    extractTokensFromToml,
    extractTokensFromYaml,
} from './token-extractor-config';
export {
    extractTokensFromDockerfile,
    extractTokensFromDotNetProject,
    extractTokensFromGradle,
    extractTokensFromHcl,
    extractTokensFromHttpRequests,
    extractTokensFromPomXml,
    extractTokensFromProto,
    extractTokensFromRequirements,
    extractTokensFromRules,
    extractTokensFromScriptText,
    extractTokensFromSql,
    extractTokensFromStructuredText,
    extractTokensFromGoMod,
    extractTokensFromXml,
} from './token-extractor-domain';

/** Extract tokens from plain text (e.g. .txt). */
export function extractTokensFromText(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    return [...set];
}
