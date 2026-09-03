
import fs from "fs/promises";
import path from "path";
import {parse} from "@babel/parser";
import * as traverseModule from "@babel/traverse";

const traverse = traverseModule.default;



// --------------------------------------------------
// 1. Find all JavaScript / TypeScript source files
// --------------------------------------------------

async function getSourceFiles(directory) {

    const entries = await fs.readdir(directory, {
        withFileTypes: true
    });

    let files = [];

    for (const entry of entries) {

        const fullPath = path.join(
            directory,
            entry.name
        );

        // Directory
        if (entry.isDirectory()) {

            // Ignore unnecessary directories
            if (
                entry.name === "node_modules" ||
                entry.name === ".git" ||
                entry.name === "dist" ||
                entry.name === "build" ||
                entry.name === "coverage"
            ) {
                continue;
            }

            const nestedFiles =
                await getSourceFiles(fullPath);

            files.push(...nestedFiles);
        }

        // File
        else {

            if (
                entry.name.endsWith(".js") ||
                entry.name.endsWith(".jsx") ||
                entry.name.endsWith(".ts") ||
                entry.name.endsWith(".tsx")
            ) {
                files.push(fullPath);
            }
        }
    }

    return files;
}


// --------------------------------------------------
// 2. Extract ES module imports
// --------------------------------------------------

function classifyImport(importPath) {

    // Local file
    if (
        importPath.startsWith("./") ||
        importPath.startsWith("../") ||
        importPath.startsWith("/")
    ) {
        return "local";
    }

    // Node built-in
    if (importPath.startsWith("node:")) {
        return "builtin";
    }

    // External npm package
    return "external";
}

function getPackageName(importPath) {

    // Local imports are not packages
    if (
        importPath.startsWith("./") ||
        importPath.startsWith("../") ||
        importPath.startsWith("/")
    ) {
        return null;
    }

    // Node built-in modules
    if (importPath.startsWith("node:")) {
        return null;
    }

    // Scoped package
    // @prisma/client
    // @eslint/js
    // @scope/package/something

    if (importPath.startsWith("@")) {

        const parts = importPath.split("/");

        return parts.slice(0, 2).join("/");
    }

    // Normal package
    // react
    // react-dom/client
    // eslint/config

    return importPath.split("/")[0];
}
function extractImports(ast) {

    const imports = [];

    for (const node of ast.program.body) {

        if (node.type !== "ImportDeclaration") {
            continue;
        }

        const importPath = node.source.value;

        const specifiers = node.specifiers.map(specifier => {

            // import express from "express"
            if (specifier.type === "ImportDefaultSpecifier") {
                return {
                    imported: "default",
                    local: specifier.local.name
                };
            }

            // import { Router } from "express"
            if (specifier.type === "ImportSpecifier") {
                return {
                    imported: specifier.imported.name,
                    local: specifier.local.name
                };
            }

            // import * as express from "express"
            if (specifier.type === "ImportNamespaceSpecifier") {
                return {
                    imported: "*",
                    local: specifier.local.name
                };
            }

            return null;
        }).filter(Boolean);

        imports.push({
            importPath,
            package: getPackageName(importPath),
            type: classifyImport(importPath),
            line: node.loc.start.line,
            specifiers
        });
    }

    return imports;
}


// --------------------------------------------------
// 3. Extract CommonJS require()
// --------------------------------------------------

function extractRequires(ast) {
    const requires = [];

    traverse(ast, {
        CallExpression(path) {
            const node = path.node;

            if (
                node.callee.type === "Identifier" &&
                node.callee.name === "require"
            ) {
                const argument = node.arguments[0];

                if (argument && argument.type === "StringLiteral") {
                    requires.push({
                        package: argument.value,
                        line: node.loc?.start.line
                    });
                }
            }
        }
    });

    return requires;
}


// --------------------------------------------------
// Export
// --------------------------------------------------

export { getSourceFiles, extractImports, extractRequires };

