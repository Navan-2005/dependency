
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

function extractApiUsages(ast, imports) {

    const apiUsages = [];

    // ---------------------------------------------------------
    // importedSymbols
    //
    // Example:
    //
    // import express from "express";
    // import jwt from "jsonwebtoken";
    // import { v4 as uuid } from "uuid";
    //
    // becomes:
    //
    // express -> express
    // jwt     -> jsonwebtoken
    // uuid    -> uuid
    // ---------------------------------------------------------

    const importedSymbols = {};

    for (const imp of imports) {

        if (imp.type !== "external") {
            continue;
        }

        for (const specifier of imp.specifiers) {

            importedSymbols[specifier.local] = {
                package: imp.package,
                imported: specifier.imported
            };
        }
    }


    // ---------------------------------------------------------
    // objectSymbols
    //
    // This tracks variables created from imported libraries.
    //
    // Example:
    //
    // const app = express();
    //
    // app -> express
    //
    // const router = express.Router();
    //
    // router -> express
    // ---------------------------------------------------------

    const objectSymbols = {};


    // ---------------------------------------------------------
    // Add API usage
    // ---------------------------------------------------------

    function addUsage({
        packageName,
        api,
        type,
        line,
        local
    }) {

        apiUsages.push({
            package: packageName,
            api,
            type,
            line,
            local
        });
    }


    // ---------------------------------------------------------
    // Visit AST
    // ---------------------------------------------------------

    function visit(node) {

        if (!node || typeof node !== "object") {
            return;
        }


        // =====================================================
        // 1. Detect:
        //
        // const app = express();
        //
        // const uuidValue = uuid();
        //
        // const prisma = PrismaClient();
        // =====================================================

        if (
            node.type === "VariableDeclarator" &&
            node.id?.type === "Identifier" &&
            node.init
        ) {

            const variableName = node.id.name;

            // -----------------------------------------------
            // const app = express()
            // -----------------------------------------------

            if (
                node.init.type === "CallExpression" &&
                node.init.callee?.type === "Identifier"
            ) {

                const functionName = node.init.callee.name;

                const imported = importedSymbols[functionName];

                if (imported) {

                    // Remember:
                    //
                    // app -> express
                    //

                    objectSymbols[variableName] = {
                        package: imported.package,
                        source: functionName,
                        api:
                            imported.imported === "default"
                                ? functionName
                                : imported.imported
                    };

                    addUsage({
                        packageName: imported.package,
                        api:
                            imported.imported === "default"
                                ? functionName
                                : imported.imported,
                        type: "function",
                        line: node.init.loc?.start.line,
                        local: functionName
                    });
                }
            }


            // -----------------------------------------------
            // const router = express.Router()
            // -----------------------------------------------

            if (
                node.init.type === "CallExpression" &&
                node.init.callee?.type === "MemberExpression"
            ) {

                const object = node.init.callee.object;
                const property = node.init.callee.property;

                if (
                    object?.type === "Identifier" &&
                    property?.type === "Identifier"
                ) {

                    const objectName = object.name;
                    const methodName = property.name;

                    const imported = importedSymbols[objectName];

                    if (imported) {

                        // Remember:
                        //
                        // router -> express
                        //

                        objectSymbols[variableName] = {
                            package: imported.package,
                            source: objectName,
                            api: methodName
                        };

                        addUsage({
                            packageName: imported.package,
                            api: methodName,
                            type: "method",
                            line: node.init.loc?.start.line,
                            local: objectName
                        });
                    }
                }
            }


            // -----------------------------------------------
            // const prisma = new PrismaClient()
            // -----------------------------------------------

            if (
                node.init.type === "NewExpression" &&
                node.init.callee?.type === "Identifier"
            ) {

                const className = node.init.callee.name;

                const imported = importedSymbols[className];

                if (imported) {

                    objectSymbols[variableName] = {
                        package: imported.package,
                        source: className,
                        api:
                            imported.imported === "default"
                                ? className
                                : imported.imported
                    };

                    addUsage({
                        packageName: imported.package,
                        api:
                            imported.imported === "default"
                                ? className
                                : imported.imported,
                        type: "constructor",
                        line: node.init.loc?.start.line,
                        local: className
                    });
                }
            }
        }


        // =====================================================
        // 2. Direct function calls
        //
        // express()
        // uuid()
        // useState()
        // =====================================================

        if (
            node.type === "CallExpression" &&
            node.callee?.type === "Identifier"
        ) {

            const localName = node.callee.name;

            const imported = importedSymbols[localName];

            if (imported) {

                addUsage({
                    packageName: imported.package,
                    api:
                        imported.imported === "default"
                            ? localName
                            : imported.imported,
                    type: "function",
                    line: node.loc?.start.line,
                    local: localName
                });
            }
        }


        // =====================================================
        // 3. Method calls on imported objects
        //
        // jwt.sign()
        // jwt.verify()
        //
        // =====================================================

        if (
            node.type === "CallExpression" &&
            node.callee?.type === "MemberExpression"
        ) {

            const object = node.callee.object;
            const property = node.callee.property;

            if (
                object?.type === "Identifier" &&
                property?.type === "Identifier"
            ) {

                const objectName = object.name;
                const methodName = property.name;

                // -------------------------------------------
                // Direct imported object
                //
                // jwt.sign()
                // -------------------------------------------

                const imported = importedSymbols[objectName];

                if (imported) {

                    addUsage({
                        packageName: imported.package,
                        api: methodName,
                        type: "method",
                        line: node.loc?.start.line,
                        local: objectName
                    });
                }


                // -------------------------------------------
                // Object created from imported library
                //
                // app.get()
                // router.post()
                // prisma.connect()
                // -------------------------------------------

                const objectInfo = objectSymbols[objectName];

                if (objectInfo) {

                    addUsage({
                        packageName: objectInfo.package,
                        api: methodName,
                        type: "method",
                        line: node.loc?.start.line,
                        local: objectName
                    });
                }
            }
        }


        // =====================================================
        // 4. new Something()
        //
        // new PrismaClient()
        // =====================================================

        if (
            node.type === "NewExpression" &&
            node.callee?.type === "Identifier"
        ) {

            const localName = node.callee.name;

            const imported = importedSymbols[localName];

            if (imported) {

                addUsage({
                    packageName: imported.package,
                    api:
                        imported.imported === "default"
                            ? localName
                            : imported.imported,
                    type: "constructor",
                    line: node.loc?.start.line,
                    local: localName
                });
            }
        }


        // =====================================================
        // Continue traversing AST
        //
        // Only visit actual AST nodes.
        // =====================================================

        for (const key of Object.keys(node)) {

            if (
                key === "loc" ||
                key === "start" ||
                key === "end" ||
                key === "range" ||
                key === "extra"
            ) {
                continue;
            }

            const value = node[key];

            if (Array.isArray(value)) {

                for (const child of value) {

                    if (
                        child &&
                        typeof child === "object" &&
                        typeof child.type === "string"
                    ) {
                        visit(child);
                    }
                }

            } else if (
                value &&
                typeof value === "object" &&
                typeof value.type === "string"
            ) {

                visit(value);
            }
        }
    }


    visit(ast);

    return apiUsages;
}


export {
    getSourceFiles,
    extractImports,
    extractRequires,
    extractApiUsages
};

