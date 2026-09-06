
import fs from "fs/promises";
import path from "path";
import {parse} from "@babel/parser";
import * as traverseModule from "@babel/traverse";
import { resolveImport } from "./moduleResolver.js";

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

    // Maps imported local variables to their package/API.
    //
    // Example:
    //
    // import express from "express"
    //
    // express -> {
    //     package: "express",
    //     api: null
    // }
    //
    // import { v4 as uuid } from "uuid"
    //
    // uuid -> {
    //     package: "uuid",
    //     api: "v4"
    // }
    const importedSymbols = new Map();


    // Maps objects created from imported APIs.
    //
    // Example:
    //
    // const app = express();
    //
    // app -> {
    //     package: "express",
    //     api: null
    // }
    //
    // const router = express.Router();
    //
    // router -> {
    //     package: "express",
    //     api: "Router"
    // }
    //
    // const prisma = new PrismaClient();
    //
    // prisma -> {
    //     package: "@prisma/client",
    //     api: "PrismaClient"
    // }
    const createdObjects = new Map();


    // Prevent duplicate detection.
    //
    // const app = express();
    //
    // The express() CallExpression is first handled while
    // processing the VariableDeclarator.
    //
    // Later the AST traversal reaches the same CallExpression.
    //
    // This Set prevents us from recording it twice.
    const handledCalls = new Set();


    // =========================================================
    // 1. BUILD IMPORTED SYMBOL MAP
    // =========================================================

    for (const imp of imports) {

        // Ignore local imports and built-ins.
        if (imp.type !== "external") {
            continue;
        }


        for (const specifier of imp.specifiers || []) {

            importedSymbols.set(
                specifier.local,
                {
                    package: imp.package,

                    // default import:
                    //
                    // import express from "express"
                    //
                    // imported = "default"
                    //
                    // We don't have a specific API name yet.
                    //
                    // named import:
                    //
                    // import { v4 as uuid } from "uuid"
                    //
                    // imported = "v4"
                    api:
                        specifier.imported === "default"
                            ? null
                            : specifier.imported
                }
            );
        }
    }


    // =========================================================
    // 2. GET LINE NUMBER
    // =========================================================

    function getLine(node) {

        return node?.loc?.start?.line || null;
    }


    // =========================================================
    // 3. RESOLVE A VARIABLE
    // =========================================================
    //
    // First check created objects.
    //
    // Example:
    //
    // app -> express
    //
    // Then check imported symbols.
    //
    // Example:
    //
    // express -> express
    //
    // =========================================================

    function resolve(name) {

        if (createdObjects.has(name)) {

            return createdObjects.get(name);
        }


        if (importedSymbols.has(name)) {

            return importedSymbols.get(name);
        }


        return null;
    }


    // =========================================================
    // 4. ADD API USAGE
    // =========================================================

function addUsage(
    packageName,
    api,
    type,
    node,
    local,
    receiver = null
) {

    // Don't add incomplete information.
    if (!packageName || !api) {
        return;
    }

    apiUsages.push({
        package: packageName,
        api,
        type,
        line: getLine(node),
        local: local || null,
        receiver
    });
}


    // =========================================================
    // 5. MAIN AST TRAVERSAL
    // =========================================================

    function visit(node) {

        // Make sure this is an actual AST node.
        if (
            !node ||
            typeof node !== "object" ||
            typeof node.type !== "string"
        ) {
            return;
        }


        // =====================================================
        // VARIABLE DECLARATIONS
        // =====================================================
        //
        // const app = express();
        //
        // const router = express.Router();
        //
        // const prisma = new PrismaClient();
        //
        // =====================================================

        if (
            node.type === "VariableDeclarator" &&
            node.id?.type === "Identifier"
        ) {

            const variableName = node.id.name;
            const initializer = node.init;


            // =================================================
            // CASE 1
            //
            // const app = express();
            //
            // =================================================

            if (
                initializer?.type === "CallExpression" &&
                initializer.callee?.type === "Identifier"
            ) {

                const functionName =
                    initializer.callee.name;


                const imported =
                    resolve(functionName);


                if (imported) {

                    // Remember that:
                    //
                    // app -> express
                    //
                    createdObjects.set(
                        variableName,
                        {
                            package: imported.package,
                            api: imported.api
                        }
                    );


                    // Record:
                    //
                    // express()
                    //
                    addUsage(
                        imported.package,

                        imported.api ||
                            functionName,

                        "function",

                        initializer,

                        variableName
                    );


                    // Prevent duplicate detection later.
                    handledCalls.add(initializer);
                }
            }


            // =================================================
            // CASE 2
            //
            // const router = express.Router();
            //
            // =================================================

            else if (
                initializer?.type === "CallExpression" &&
                initializer.callee?.type === "MemberExpression" &&
                !initializer.callee.computed &&
                initializer.callee.object?.type === "Identifier" &&
                initializer.callee.property?.type === "Identifier"
            ) {

                const objectName =
                    initializer.callee.object.name;


                const methodName =
                    initializer.callee.property.name;


                const imported =
                    resolve(objectName);


                if (imported) {

                    // Remember:
                    //
                    // router -> express.Router
                    //
                    createdObjects.set(
                        variableName,
                        {
                            package: imported.package,
                            api: methodName
                        }
                    );


                    // Record:
                    //
                    // express.Router()
                    //
                    addUsage(
                        imported.package,
                        methodName,
                        "method",
                        initializer,
                        variableName
                    );


                    // Prevent duplicate detection.
                    handledCalls.add(initializer);
                }
            }


            // =================================================
            // CASE 3
            //
            // const prisma = new PrismaClient();
            //
            // =================================================

            else if (
                initializer?.type === "NewExpression" &&
                initializer.callee?.type === "Identifier"
            ) {

                const constructorName =
                    initializer.callee.name;


                const imported =
                    resolve(constructorName);


                if (imported) {

                    // Remember:
                    //
                    // prisma -> PrismaClient
                    //
                    createdObjects.set(
                        variableName,
                        {
                            package: imported.package,
                            api:
                                imported.api ||
                                constructorName
                        }
                    );


                    // Record constructor usage.
                    addUsage(
                        imported.package,

                        imported.api ||
                            constructorName,

                        "constructor",

                        initializer,

                        variableName
                    );
                }
            }
        }


        // =====================================================
        // CALL EXPRESSIONS
        // =====================================================
        //
        // Handles:
        //
        // app.get()
        // app.post()
        // app.use()
        //
        // router.get()
        // router.post()
        //
        // jwt.sign()
        // jwt.verify()
        //
        // uuid()
        // useState()
        //
        // =====================================================

        if (node.type === "CallExpression") {

            // If this call was already handled while processing
            // VariableDeclarator, don't process it again.
            if (!handledCalls.has(node)) {

                const callee = node.callee;


                // =================================================
                // MEMBER CALL
                //
                // app.get()
                // app.post()
                //
                // router.get()
                //
                // jwt.sign()
                //
                // =================================================

                if (
                    callee.type === "MemberExpression" &&
                    !callee.computed &&
                    callee.object?.type === "Identifier" &&
                    callee.property?.type === "Identifier"
                ) {

                    const objectName =
                        callee.object.name;


                    const methodName =
                        callee.property.name;


                    const resolved =
                        resolve(objectName);


                    if (resolved) {

                        addUsage(
                            resolved.package,
                            methodName,
                            "method",
                            node,
                            objectName
                        );
                    }
                }


                // =================================================
                // DIRECT FUNCTION CALL
                //
                // uuid()
                // useState()
                // express()
                //
                // =================================================

                else if (
                    callee.type === "Identifier"
                ) {

                    const functionName =
                        callee.name;


                    const resolved =
                        resolve(functionName);


                    if (resolved) {

                        addUsage(
                            resolved.package,

                            resolved.api ||
                                functionName,

                            "function",

                            node,

                            functionName
                        );
                    }
                }
            }
        }


        // =====================================================
        // SAFE AST TRAVERSAL
        // =====================================================
        //
        // IMPORTANT:
        //
        // Do NOT blindly recursively traverse every object
        // property.
        //
        // Babel AST nodes contain metadata such as loc,
        // start, end, etc.
        //
        // Only visit objects that are actual AST nodes.
        //
        // =====================================================

        for (const key of Object.keys(node)) {

            // Skip metadata / non-AST properties.
            if (
                key === "loc" ||
                key === "start" ||
                key === "end" ||
                key === "range" ||
                key === "extra"
            ) {
                continue;
            }


            const child = node[key];


            // =================================================
            // Array of AST nodes
            // =================================================

            if (Array.isArray(child)) {

                for (const item of child) {

                    if (
                        item &&
                        typeof item === "object" &&
                        typeof item.type === "string"
                    ) {

                        visit(item);
                    }
                }
            }


            // =================================================
            // Single AST node
            // =================================================

            else if (
                child &&
                typeof child === "object" &&
                typeof child.type === "string"
            ) {

                visit(child);
            }
        }
    }


    // =========================================================
    // START TRAVERSAL
    // =========================================================

    visit(ast);


    // =========================================================
    // RETURN RESULTS
    // =========================================================

    return apiUsages;
}

export {
    getSourceFiles,
    extractImports,
    extractRequires,
    extractApiUsages
};

