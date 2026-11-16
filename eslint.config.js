import js from "@eslint/js";
import globals from "globals";

export default [
    // Ignored paths
    {
        ignores: [
            "node_modules/**",
            "public/uploads/**",
            "coverage/**",
            ".git/**"
        ]
    },

    // Base ESLint recommended rules
    js.configs.recommended,

    // Node.js backend environment
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es2024
            }
        },
        rules: {
            "no-unused-vars": ["warn", {
                args: "after-used",
                argsIgnorePattern: "^_|^(req|res|next)$",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_"
            }],
            "no-console": "off",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "no-var": "error",
            "prefer-const": ["warn", { destructuring: "all" }]
        }
    },

    // Browser scripts
    {
        files: ["public/js/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
            globals: {
                ...globals.browser,
                ...globals.es2024,
                Swal: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", {
                args: "after-used",
                argsIgnorePattern: "^_|^(req|res|next)$",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_"
            }],
            "no-console": "off",
            "no-empty": ["error", { allowEmptyCatch: true }]
        }
    }
];
