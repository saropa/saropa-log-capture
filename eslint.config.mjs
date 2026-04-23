import typescriptEslint from "typescript-eslint";

export default [{
    files: ["**/*.ts"],

    plugins: {
        "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
        }],

        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "warn",
        "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
        "max-params": ["warn", { max: 4 }],
        "max-depth": ["warn", { max: 3 }],
        "no-var": "warn",
        "prefer-const": "warn",
        "no-constant-condition": "warn",
        "no-duplicate-case": "warn",
        "no-self-assign": "warn",
        "no-unreachable": "warn",
    },
}, {
    // Test files need any for mocking
    files: ["src/test/**/*.ts"],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
    },
}, {
    // Single module emits the full webview client script as one template literal; line budget is higher than typical TS.
    files: ["src/ui/viewer/viewer-script.ts"],
    rules: {
        "max-lines": ["warn", { max: 340, skipBlankLines: true, skipComments: true }],
    },
}, {
    // Small ViewerTarget surface growth (DB detector toggles, typography settings pipeline)
    // without another provider split. Bumped 320 → 325 when the typography setLogFontSize /
    // setLogLineHeight pre-handler pattern was added alongside the existing handleDbMessages one.
    files: [
        "src/ui/provider/log-viewer-provider.ts",
        "src/ui/viewer-panels/pop-out-panel.ts",
        "src/ui/viewer/viewer-script-messages.ts",
    ],
    rules: {
        "max-lines": ["warn", { max: 325, skipBlankLines: true, skipComments: true }],
    },
}];
