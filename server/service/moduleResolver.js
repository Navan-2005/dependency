

import fs from 'fs'
import path from 'path';
import { builtinModules } from 'module';


// ============================================================
// Supported source extensions
// ============================================================

const SOURCE_EXTENSIONS = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs"
];


// ============================================================
// Node built-in modules
// ============================================================

const NODE_BUILTINS = new Set([
    ...builtinModules,
    ...builtinModules.map((module) => `node:${module}`)
]);


// ============================================================
// Main resolver
// ============================================================

function resolveImport(importPath, importerFile, repoRoot) {

    // --------------------------------------------------------
    // 1. Node builtin
    // --------------------------------------------------------

    if (isBuiltin(importPath)) {

        return {
            importPath,
            type: "builtin",
            package: null,
            resolvedPath: null
        };
    }


    // --------------------------------------------------------
    // 2. Relative import
    // --------------------------------------------------------

    if (
        importPath.startsWith("./") ||
        importPath.startsWith("../")
    ) {

        const absolutePath = resolveLocalPath(
            importPath,
            importerFile
        );

        if (absolutePath) {

            return {
                importPath,
                type: "local",
                package: null,
                resolvedPath: toRepoRelativePath(
                    absolutePath,
                    repoRoot
                )
            };
        }

        return {
            importPath,
            type: "unresolved",
            package: null,
            resolvedPath: null
        };
    }


    // --------------------------------------------------------
    // 3. Project aliases / local modules
    // --------------------------------------------------------

    const aliasPath = resolveAlias(
        importPath,
        importerFile,
        repoRoot
    );

    if (aliasPath) {

        return {
            importPath,
            type: "local",
            package: null,
            resolvedPath: toRepoRelativePath(
                aliasPath,
                repoRoot
            )
        };
    }


    // --------------------------------------------------------
    // 4. npm package
    // --------------------------------------------------------

    const packageName =
        getPackageName(importPath);

    return {
        importPath,
        type: "external",
        package: packageName,
        resolvedPath: null
    };
}


// ============================================================
// Check Node builtin
// ============================================================

function isBuiltin(importPath) {

    return NODE_BUILTINS.has(importPath);
}


// ============================================================
// Resolve relative path
//
// Example:
//
// importer:
//
// server/controller/credentials.js
//
// import:
//
// ../middleware/middleware.js
//
// Result:
//
// server/middleware/middleware.js
// ============================================================

function resolveLocalPath(importPath, importerFile) {

    const importerDirectory =
        path.dirname(importerFile);


    const absoluteBasePath =
        path.resolve(
            importerDirectory,
            importPath
        );


    return resolveFileOrDirectory(
        absoluteBasePath
    );
}


// ============================================================
// Resolve aliases
// ============================================================

function resolveAlias(
    importPath,
    importerFile,
    repoRoot
) {

    // --------------------------------------------------------
    // First try tsconfig.json
    // --------------------------------------------------------

    const tsConfigPath =
        path.join(repoRoot, "tsconfig.json");


    if (fs.existsSync(tsConfigPath)) {

        const aliases =
            readTsConfigAliases(
                tsConfigPath,
                repoRoot
            );


        const resolved =
            resolveUsingAliases(
                importPath,
                aliases
            );


        if (resolved) {
            return resolved;
        }
    }


    // --------------------------------------------------------
    // Then try jsconfig.json
    // --------------------------------------------------------

    const jsConfigPath =
        path.join(repoRoot, "jsconfig.json");


    if (fs.existsSync(jsConfigPath)) {

        const aliases =
            readTsConfigAliases(
                jsConfigPath,
                repoRoot
            );


        const resolved =
            resolveUsingAliases(
                importPath,
                aliases
            );


        if (resolved) {
            return resolved;
        }
    }


    // --------------------------------------------------------
    // Vite aliases
    //
    // We handle common Vite configurations separately.
    // --------------------------------------------------------

    const viteConfigs = [
        "vite.config.js",
        "vite.config.ts",
        "vite.config.mjs"
    ];


    for (const configName of viteConfigs) {

        const viteConfigPath =
            path.join(
                repoRoot,
                configName
            );


        if (!fs.existsSync(viteConfigPath)) {
            continue;
        }


        const viteAliases =
            readViteAliases(
                viteConfigPath,
                repoRoot
            );


        const resolved =
            resolveUsingAliases(
                importPath,
                viteAliases
            );


        if (resolved) {
            return resolved;
        }
    }


    // --------------------------------------------------------
    // Common project alias fallback
    //
    // Some projects use:
    //
    // import { prisma } from "db";
    //
    // where db is actually:
    //
    // <repo>/db
    //
    // This is NOT a universal Node rule.
    //
    // We only use it if the path actually exists.
    // --------------------------------------------------------

    const commonPaths = [
        path.join(repoRoot, importPath),
        path.join(repoRoot, "src", importPath),
        path.join(repoRoot, "server", importPath)
    ];


    for (const candidate of commonPaths) {

        const resolved =
            resolveFileOrDirectory(candidate);


        if (resolved) {
            return resolved;
        }
    }


    return null;
}


// ============================================================
// Read tsconfig/jsconfig paths
// ============================================================

function readTsConfigAliases(
    configPath,
    repoRoot
) {

    try {

        const raw =
            fs.readFileSync(
                configPath,
                "utf8"
            );


        // tsconfig files can contain comments.
        // This removes the most common // and /* */ comments.
        const cleaned =
            raw
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/^\s*\/\/.*$/gm, "");


        const config =
            JSON.parse(cleaned);


        const compilerOptions =
            config.compilerOptions || {};


        const paths =
            compilerOptions.paths || {};


        const baseUrl =
            compilerOptions.baseUrl || ".";


        const aliases = [];


        for (const [alias, targets] of Object.entries(paths)) {

            if (!Array.isArray(targets)) {
                continue;
            }


            for (const target of targets) {

                aliases.push({
                    alias,
                    target: path.resolve(
                        repoRoot,
                        baseUrl,
                        target
                    )
                });
            }
        }


        // Also support:
        //
        // baseUrl: "."
        //
        // without explicit paths.
        if (
            Object.keys(paths).length === 0 &&
            compilerOptions.baseUrl
        ) {

            aliases.push({
                alias: "*",
                target: path.resolve(
                    repoRoot,
                    baseUrl,
                    "*"
                )
            });
        }


        return aliases;

    } catch (error) {

        console.warn(
            `Could not read ${configPath}: ${error.message}`
        );


        return [];
    }
}


// ============================================================
// Resolve an import using aliases
// ============================================================

function resolveUsingAliases(
    importPath,
    aliases
) {

    for (const alias of aliases) {

        const aliasPattern =
            alias.alias;


        // ---------------------------------------------
        // Exact alias
        //
        // "db"
        // ---------------------------------------------

        if (
            aliasPattern !== "*" &&
            !aliasPattern.includes("*") &&
            importPath === aliasPattern
        ) {

            const target =
                alias.target;


            const resolved =
                resolveFileOrDirectory(target);


            if (resolved) {
                return resolved;
            }
        }


        // ---------------------------------------------
        // Wildcard alias
        //
        // "@/*"
        //
        // "@components/*"
        // ---------------------------------------------

        if (aliasPattern.includes("*")) {

            const [prefix, suffix] =
                aliasPattern.split("*");


            if (
                importPath.startsWith(prefix) &&
                importPath.endsWith(suffix)
            ) {

                const middle =
                    importPath.slice(
                        prefix.length,
                        importPath.length - suffix.length
                    );


                const target =
                    alias.target.replace(
                        "*",
                        middle
                    );


                const resolved =
                    resolveFileOrDirectory(target);


                if (resolved) {
                    return resolved;
                }
            }
        }
    }


    return null;
}


// ============================================================
// Read Vite aliases
//
// This is intentionally lightweight.
//
// It supports common configurations such as:
//
// resolve: {
//     alias: {
//         "@": path.resolve(__dirname, "./src"),
//         db: path.resolve(__dirname, "./db")
//     }
// }
// ============================================================

function readViteAliases(
    configPath,
    repoRoot
) {

    try {

        const source =
            fs.readFileSync(
                configPath,
                "utf8"
            );


        const aliases = [];


        // ----------------------------------------------------
        // Match:
        //
        // "@": path.resolve(__dirname, "./src")
        //
        // "db": path.resolve(__dirname, "./db")
        //
        // ----------------------------------------------------

        const pathResolveRegex =
            /["']([^"']+)["']\s*:\s*path\.resolve\(\s*__dirname\s*,\s*["']([^"']+)["']\s*\)/g;


        let match;


        while (
            (match = pathResolveRegex.exec(source)) !== null
        ) {

            aliases.push({
                alias: match[1],
                target: path.resolve(
                    repoRoot,
                    match[2]
                )
            });
        }


        // ----------------------------------------------------
        // Match simple string aliases:
        //
        // "@": "./src"
        //
        // "db": "./db"
        // ----------------------------------------------------

        const stringRegex =
            /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g;


        while (
            (match = stringRegex.exec(source)) !== null
        ) {

            const aliasName = match[1];
            const target = match[2];


            // Ignore unrelated configuration properties.
            if (
                aliasName === "root" ||
                aliasName === "base" ||
                aliasName === "mode"
            ) {
                continue;
            }


            if (
                target.startsWith(".") ||
                target.startsWith("/")
            ) {

                aliases.push({
                    alias: aliasName,
                    target: path.resolve(
                        repoRoot,
                        target
                    )
                });
            }
        }


        return aliases;

    } catch (error) {

        console.warn(
            `Could not read Vite config ${configPath}: ${error.message}`
        );


        return [];
    }
}


// ============================================================
// Resolve file or directory
//
// Handles:
//
// ./foo
// ./foo.js
// ./foo.jsx
// ./foo.ts
// ./foo.tsx
//
// ./foo/index.js
// ./foo/index.ts
// ============================================================

function resolveFileOrDirectory(basePath) {

    // --------------------------------------------------------
    // Exact file
    // --------------------------------------------------------

    if (fs.existsSync(basePath)) {

        const stat =
            fs.statSync(basePath);


        if (stat.isFile()) {

            return normalizePath(basePath);
        }
    }


    // --------------------------------------------------------
    // Try extensions
    // --------------------------------------------------------

    for (const extension of SOURCE_EXTENSIONS) {

        const candidate =
            `${basePath}${extension}`;


        if (fs.existsSync(candidate)) {

            const stat =
                fs.statSync(candidate);


            if (stat.isFile()) {

                return normalizePath(candidate);
            }
        }
    }


    // --------------------------------------------------------
    // Try index files
    // --------------------------------------------------------

    if (fs.existsSync(basePath)) {

        const stat =
            fs.statSync(basePath);


        if (stat.isDirectory()) {

            for (const extension of SOURCE_EXTENSIONS) {

                const candidate =
                    path.join(
                        basePath,
                        `index${extension}`
                    );


                if (fs.existsSync(candidate)) {

                    return normalizePath(candidate);
                }
            }
        }
    }


    return null;
}


// ============================================================
// Convert Windows paths to consistent paths
//
// This makes your JSON output:
//
// server/controller/file.js
//
// instead of:
//
// server\controller\file.js
// ============================================================

function normalizePath(filePath) {

    return path
        .normalize(filePath)
        .replace(/\\/g, "/");
}


// ============================================================
// Get npm package name
//
// express
// jsonwebtoken
//
// @prisma/client
// @vitejs/plugin-react
// ============================================================
function toRepoRelativePath(
    absolutePath,
    repoRoot
) {
    return path
        .relative(
            path.resolve(repoRoot),
            path.resolve(absolutePath)
        )
        .replace(/\\/g, "/");
}


function getPackageName(importPath) {

    if (importPath.startsWith("@")) {

        const parts =
            importPath.split("/");


        return parts.length >= 2
            ? `${parts[0]}/${parts[1]}`
            : importPath;
    }


    return importPath.split("/")[0];
}


export {
    resolveImport
};