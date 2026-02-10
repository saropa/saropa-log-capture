import typescriptEslint from "typescript-eslint";

export default [{
    files: ["**/*.ts"],
}, {
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
}];
