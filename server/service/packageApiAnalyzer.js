// service/packageApiAnalyzer.js

import fs from "fs";
import path from "path";
import os from "os";
import {
    execSync
} from "child_process";
// import tar from 'tar'
import { parse } from "@babel/parser";


const IGNORED_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    "coverage",
    "test",
    "tests"
]);

// --------------------------------------------------
// Extract TypeScript declaration APIs
// --------------------------------------------------

function extractDeclarationApis(
    ast,
    filePath
) {

    const apis = [];


    function addApi(api) {

        const exists =
            apis.some(
                (existing) =>
                    existing.name === api.name &&
                    existing.type === api.type &&
                    existing.kind === api.kind
            );


        if (!exists) {
            apis.push(api);
        }
    }


    function getTypeName(typeNode) {

        if (!typeNode) {
            return null;
        }


        if (
            typeNode.type ===
            "TSTypeAnnotation"
        ) {

            return getTypeName(
                typeNode.typeAnnotation
            );
        }


        if (
            typeNode.type ===
            "TSTypeReference"
        ) {

            if (
                typeNode.typeName?.name
            ) {

                return typeNode.typeName.name;
            }
        }


        if (
            typeNode.type ===
            "TSStringKeyword"
        ) {
            return "string";
        }


        if (
            typeNode.type ===
            "TSNumberKeyword"
        ) {
            return "number";
        }


        if (
            typeNode.type ===
            "TSBooleanKeyword"
        ) {
            return "boolean";
        }


        if (
            typeNode.type ===
            "TSVoidKeyword"
        ) {
            return "void";
        }


        if (
            typeNode.type ===
            "TSAnyKeyword"
        ) {
            return "any";
        }


        if (
            typeNode.type ===
            "TSUnknownKeyword"
        ) {
            return "unknown";
        }


        if (
            typeNode.type ===
            "TSArrayType"
        ) {

            const elementType =
                getTypeName(
                    typeNode.elementType
                );

            return elementType
                ? `${elementType}[]`
                : "array";
        }


        if (
            typeNode.type ===
            "TSUnionType"
        ) {

            return typeNode.types
                .map(
                    getTypeName
                )
                .filter(
                    Boolean
                )
                .join("|");
        }


        return typeNode.type;
    }


    function getParameterName(
        parameter
    ) {

        if (!parameter) {
            return null;
        }


        if (
            parameter.type ===
            "Identifier"
        ) {

            return parameter.name;
        }


        if (
            parameter.type ===
            "RestElement"
        ) {

            const name =
                getParameterName(
                    parameter.argument
                );

            return name
                ? `...${name}`
                : null;
        }


        if (
            parameter.type ===
            "AssignmentPattern"
        ) {

            return getParameterName(
                parameter.left
            );
        }


        return "...";
    }


    function extractParameters(
        params
    ) {

        return (params || [])
            .map(
                (parameter) => {

                    return {

                        name:
                            getParameterName(
                                parameter
                            ),

                        type:
                            getTypeName(
                                parameter.typeAnnotation
                            ),

                        optional:
                            Boolean(
                                parameter.optional
                            )
                    };
                }
            );
    }


    function extractMembers(
        members
    ) {

        const result = [];


        for (
            const member
            of members || []
        ) {

            // ------------------------------------------
            // method
            // ------------------------------------------

            if (
                member.type ===
                "TSMethodSignature"
            ) {

                const name =
                    member.key?.name ||
                    member.key?.value;


                if (!name) {
                    continue;
                }


                result.push({

                    name,

                    type:
                        "method",

                    parameters:
                        extractParameters(
                            member.parameters
                        ),

                    returnType:
                        getTypeName(
                            member.typeAnnotation
                        ),

                    optional:
                        Boolean(
                            member.optional
                        ),

                    line:
                        member.loc?.start?.line
                });

                continue;
            }


            // ------------------------------------------
            // property
            // ------------------------------------------

            if (
                member.type ===
                "TSPropertySignature"
            ) {

                const name =
                    member.key?.name ||
                    member.key?.value;


                if (!name) {
                    continue;
                }


                result.push({

                    name,

                    type:
                        "property",

                    propertyType:
                        getTypeName(
                            member.typeAnnotation
                        ),

                    optional:
                        Boolean(
                            member.optional
                        ),

                    line:
                        member.loc?.start?.line
                });
            }
        }


        return result;
    }


    function visit(node) {

        if (
            !node ||
            typeof node !== "object"
        ) {
            return;
        }


        if (!node.type) {
            return;
        }


        // ==================================================
        // interface
        // ==================================================

        if (
            node.type ===
            "TSInterfaceDeclaration"
        ) {

            const name =
                node.id?.name;


            if (name) {

                addApi({

                    name,

                    type:
                        "interface",

                    kind:
                        "interface",

                    members:
                        extractMembers(
                            node.body?.body
                        ),

                    file:
                        filePath,

                    line:
                        node.loc?.start?.line
                });
            }
        }


        // ==================================================
        // type alias
        // ==================================================

        if (
            node.type ===
            "TSTypeAliasDeclaration"
        ) {

            const name =
                node.id?.name;


            if (name) {

                addApi({

                    name,

                    type:
                        "type",

                    kind:
                        "type",

                    definition:
                        getTypeName(
                            node.typeAnnotation
                        ),

                    file:
                        filePath,

                    line:
                        node.loc?.start?.line
                });
            }
        }


        // ==================================================
        // declare class
        // ==================================================

        if (
            node.type ===
            "ClassDeclaration"
        ) {

            const name =
                node.id?.name;


            if (name) {

                addApi({

                    name,

                    type:
                        "class",

                    kind:
                        "class",

                    methods:
                        extractMembers(
                            node.body?.body
                        ),

                    file:
                        filePath,

                    line:
                        node.loc?.start?.line
                });
            }
        }


        // ==================================================
        // function declaration
        // ==================================================

        if (
            node.type ===
            "TSDeclareFunction"
        ) {

            const name =
                node.id?.name;


            if (name) {

                addApi({

                    name,

                    type:
                        "function",

                    kind:
                        "function",

                    parameters:
                        extractParameters(
                            node.params
                        ),

                    returnType:
                        getTypeName(
                            node.returnType
                        ),

                    file:
                        filePath,

                    line:
                        node.loc?.start?.line
                });
            }
        }


        // ==================================================
        // variable declaration
        // ==================================================

        if (
            node.type ===
            "VariableDeclaration"
        ) {

            for (
                const declaration
                of node.declarations || []
            ) {

                const name =
                    declaration.id?.name;


                if (!name) {
                    continue;
                }


                if (
                    declaration.id
                        ?.typeAnnotation
                ) {

                    addApi({

                        name,

                        type:
                            "variable",

                        kind:
                            "variable",

                        variableType:
                            getTypeName(
                                declaration.id
                                    .typeAnnotation
                            ),

                        file:
                            filePath,

                        line:
                            declaration.loc?.start?.line
                    });
                }
            }
        }


        // ==================================================
        // Continue traversal
        // ==================================================

        for (
            const key
            of Object.keys(node)
        ) {

            if (
                key === "loc" ||
                key === "start" ||
                key === "end" ||
                key === "range" ||
                key === "extra"
            ) {
                continue;
            }


            const value =
                node[key];


            if (Array.isArray(value)) {

                for (
                    const child
                    of value
                ) {

                    if (
                        child &&
                        typeof child === "object"
                    ) {

                        visit(child);
                    }
                }

            }
            else if (
                value &&
                typeof value === "object"
            ) {

                visit(value);
            }
        }
    }


    visit(ast);

    return apis;
}

// --------------------------------------------------
// Get parameter name
// --------------------------------------------------

function getParameterName(parameter) {

    if (!parameter) {
        return null;
    }


    // function foo(value)
    if (
        parameter.type ===
        "Identifier"
    ) {

        return parameter.name;
    }


    // function foo(value = 10)
    if (
        parameter.type ===
        "AssignmentPattern"
    ) {

        return getParameterName(
            parameter.left
        );
    }


    // function foo(...args)
    if (
        parameter.type ===
        "RestElement"
    ) {

        const name =
            getParameterName(
                parameter.argument
            );

        return name
            ? `...${name}`
            : null;
    }


    // TypeScript parameter
    if (
        parameter.type ===
        "TSParameterProperty"
    ) {

        return getParameterName(
            parameter.parameter
        );
    }


    // Destructuring
    if (
        parameter.type ===
        "ObjectPattern"
    ) {

        return "{...}";
    }


    if (
        parameter.type ===
        "ArrayPattern"
    ) {

        return "[...]";
    }


    return null;
}


// --------------------------------------------------
// Get function parameters
// --------------------------------------------------

function getFunctionParameters(
    node
) {

    return (
        node.params || []
    )
        .map(
            getParameterName
        )
        .filter(
            Boolean
        );
}


// --------------------------------------------------
// Get TypeScript return type
// --------------------------------------------------

function getReturnType(node) {

    if (
        !node.returnType
    ) {
        return null;
    }


    const typeAnnotation =
        node.returnType.typeAnnotation;


    if (!typeAnnotation) {
        return null;
    }


    if (
        typeAnnotation.type ===
        "TSTypeReference"
    ) {

        return (
            typeAnnotation.typeName?.name ||
            null
        );
    }


    if (
        typeAnnotation.type ===
        "TSStringKeyword"
    ) {
        return "string";
    }


    if (
        typeAnnotation.type ===
        "TSNumberKeyword"
    ) {
        return "number";
    }


    if (
        typeAnnotation.type ===
        "TSBooleanKeyword"
    ) {
        return "boolean";
    }


    if (
        typeAnnotation.type ===
        "TSVoidKeyword"
    ) {
        return "void";
    }


    return typeAnnotation.type;
}


// --------------------------------------------------
// Extract methods from a class
// --------------------------------------------------

function extractClassMethods(
    classNode,
    filePath
) {

    const methods = [];


    for (
        const member
        of classNode.body?.body || []
    ) {

        // ---------------------------------------------
        // class method
        // ---------------------------------------------

        if (
            member.type ===
            "ClassMethod"
        ) {

            const name =
                member.key?.name ||
                member.key?.value;


            if (!name) {
                continue;
            }


            methods.push({

                name,

                type:
                    "method",

                parameters:
                    getFunctionParameters(
                        member
                    ),

                returnType:
                    getReturnType(
                        member
                    ),

                static:
                    Boolean(
                        member.static
                    ),

                async:
                    Boolean(
                        member.async
                    ),

                file:
                    filePath,

                line:
                    member.loc?.start?.line
            });
        }


        // ---------------------------------------------
        // class property
        // ---------------------------------------------

        if (
            member.type ===
            "ClassProperty"
        ) {

            const name =
                member.key?.name ||
                member.key?.value;


            if (!name) {
                continue;
            }


            methods.push({

                name,

                type:
                    "property",

                static:
                    Boolean(
                        member.static
                    ),

                file:
                    filePath,

                line:
                    member.loc?.start?.line
            });
        }
    }


    return methods;
}


// --------------------------------------------------
// Extract interfaces
// --------------------------------------------------

function extractInterfaceMembers(
    interfaceNode,
    filePath
) {

    const members = [];


    for (
        const member
        of interfaceNode.body?.body || []
    ) {

        // ---------------------------------------------
        // interface method
        // ---------------------------------------------

        if (
            member.type ===
            "TSMethodSignature"
        ) {

            const name =
                member.key?.name ||
                member.key?.value;


            if (!name) {
                continue;
            }


            members.push({

                name,

                type:
                    "method",

                parameters:
                    getFunctionParameters(
                        member
                    ),

                returnType:
                    getReturnType(
                        member
                    ),

                file:
                    filePath,

                line:
                    member.loc?.start?.line
            });
        }


        // ---------------------------------------------
        // interface property
        // ---------------------------------------------

        if (
            member.type ===
            "TSPropertySignature"
        ) {

            const name =
                member.key?.name ||
                member.key?.value;


            if (!name) {
                continue;
            }


            members.push({

                name,

                type:
                    "property",

                file:
                    filePath,

                line:
                    member.loc?.start?.line
            });
        }
    }


    return members;
}
/**
 * Get all JavaScript / TypeScript source files
 * inside a package.
 */
function getPackageSourceFiles(packageRoot) {

    const files = [];


    function walk(directory) {

        let entries;

        try {

            entries =
                fs.readdirSync(
                    directory,
                    {
                        withFileTypes: true
                    }
                );

        }
        catch {

            return;
        }


        for (const entry of entries) {

            if (
                entry.isDirectory() &&
                IGNORED_DIRECTORIES.has(entry.name)
            ) {
                continue;
            }


            const fullPath =
                path.join(
                    directory,
                    entry.name
                );


            if (entry.isDirectory()) {

                walk(fullPath);

                continue;
            }


            if (!entry.isFile()) {
                continue;
            }


            const extension =
                path.extname(
                    entry.name
                ).toLowerCase();


            if (
                extension === ".js" ||
                extension === ".jsx" ||
                extension === ".ts" ||
                extension === ".tsx" ||
                extension === ".d.ts" ||
                extension === ".mjs" ||
                extension === ".cjs"
            ) {

                files.push(fullPath);
            }
        }
    }


    walk(packageRoot);

    return files;
}


/**
 * Parse a source file.
 */
function parseSourceFile(filePath) {

    try {

        const code =
            fs.readFileSync(
                filePath,
                "utf8"
            );


        return parse(
            code,
            {
                sourceType: "unambiguous",

                plugins: [
                    "jsx",
                    "typescript"
                ],

                ranges: true,

                locations: true
            }
        );

    }
    catch {

        return null;
    }
}


/**
 * Extract exports from a CommonJS source file.
 *
 * Handles the CommonJS export patterns used by
 * packages such as Express:
 *
 *   module.exports = createApplication
 *   exports = module.exports = createApplication
 *   exports.application = proto
 *   module.exports.Router = Router
 *   module.exports = { foo, bar }
 *   var app = exports = module.exports = {}
 *   app.get = function (...) {}
 *
 * Aliases for the module export object (exports,
 * module.exports, and local variables assigned to
 * them) are tracked so that method assignments such
 * as `app.get = function` or `res.send = function`
 * are exposed as named APIs.
 */
// --------------------------------------------------
// Extract CommonJS exports
// --------------------------------------------------

function extractCommonJsExports(
    ast,
    filePath
) {

    const exports = [];

    const moduleAliases =
        new Set();

    const declaredFunctions =
        new Set();


    function addApi(api) {

        const duplicate =
            exports.some(
                (existing) =>
                    existing.name === api.name &&
                    existing.type === api.type &&
                    existing.kind === api.kind
            );


        if (!duplicate) {
            exports.push(api);
        }
    }


    // ------------------------------------------------
    // Reference helpers
    // ------------------------------------------------

    function isPrimaryExportTarget(node) {

        if (!node) {
            return false;
        }


        // exports
        if (
            node.type === "Identifier" &&
            node.name === "exports"
        ) {
            return true;
        }


        // module.exports
        if (
            node.type === "MemberExpression" &&
            !node.computed &&
            node.object?.type === "Identifier" &&
            node.object.name === "module" &&
            node.property?.name === "exports"
        ) {
            return true;
        }


        return false;
    }


    function isModuleExportsRef(node) {

        if (!node) {
            return false;
        }


        if (
            isPrimaryExportTarget(
                node
            )
        ) {
            return true;
        }


        // Local alias such as `app` or `res`
        if (
            node.type === "Identifier" &&
            moduleAliases.has(
                node.name
            )
        ) {
            return true;
        }


        return false;
    }


    function getMemberName(node) {

        if (
            node?.type !==
            "MemberExpression"
        ) {
            return null;
        }


        return (
            node.property?.name ||
            node.property?.value ||
            null
        );
    }


    function getOwnerName(node) {

        if (!node) {
            return null;
        }


        if (
            node.type ===
            "Identifier"
        ) {
            return node.name;
        }


        if (
            node.type ===
            "MemberExpression"
        ) {
            return "module.exports";
        }


        return null;
    }


    function unwrapAssignmentRhs(node) {

        while (
            node &&
            node.type ===
            "AssignmentExpression"
        ) {
            node = node.right;
        }


        return node;
    }


    function chainAssignsExport(node) {

        let current = node;


        while (
            current &&
            current.type ===
            "AssignmentExpression"
        ) {

            if (
                isPrimaryExportTarget(
                    current.left
                )
            ) {
                return true;
            }


            current =
                current.right;
        }


        return false;
    }


    // ------------------------------------------------
    // Type inference
    // ------------------------------------------------

    function getRhsType(rhs) {

        if (!rhs) {
            return "variable";
        }


        switch (rhs.type) {

            case "FunctionExpression":
            case "ArrowFunctionExpression":
                return "function";

            case "ClassExpression":
                return "class";

            case "ObjectExpression":
                return "object";

            case "Identifier":
                return (
                    declaredFunctions.has(
                        rhs.name
                    )
                        ? "function"
                        : "variable"
                );

            default:
                return "variable";
        }
    }


    function getExportName(rhs) {

        if (!rhs) {
            return null;
        }


        if (
            rhs.type ===
            "Identifier"
        ) {
            return rhs.name;
        }


        if (
            rhs.type ===
            "FunctionExpression"
        ) {
            return rhs.id?.name ||
                null;
        }


        if (
            rhs.type ===
            "ClassExpression"
        ) {
            return rhs.id?.name ||
                null;
        }


        return null;
    }


    function collectSignature(api, rhs) {

        if (
            rhs &&
            (
                rhs.type ===
                "FunctionExpression" ||
                rhs.type ===
                "ArrowFunctionExpression"
            )
        ) {

            api.parameters =
                getFunctionParameters(
                    rhs
                );

            api.returnType =
                getReturnType(
                    rhs
                );
        }
    }


    // ------------------------------------------------
    // Export emitters
    // ------------------------------------------------

    function emitPrimaryExport(
        rhs,
        line
    ) {

        const type =
            getRhsType(
                rhs
            );


        // module.exports = { foo, bar, ... }
        if (
            type ===
            "object"
        ) {

            emitObjectLiteral(
                rhs,
                line
            );

            return;
        }


        const name =
            getExportName(
                rhs
            ) ||
            "module.exports";


        const api = {

            name,

            type,

            kind:
                type,

            file:
                filePath,

            line
        };


        collectSignature(
            api,
            rhs
        );


        addApi(api);


        // Track aliases:
        // module.exports = res; ...; res.send = function
        if (
            rhs &&
            rhs.type ===
            "Identifier"
        ) {
            moduleAliases.add(
                rhs.name
            );
        }
    }


    function emitObjectLiteral(
        node,
        line,
        parent
    ) {

        for (
            const property
            of node.properties || []
        ) {

            if (
                property.type !==
                "ObjectProperty"
            ) {
                continue;
            }


            const name =
                property.key?.name ||
                property.key?.value;


            if (!name) {
                continue;
            }


            const rhs =
                property.value;


            const type =
                getRhsType(
                    rhs
                );


            const api = {

                name,

                type,

                kind:
                    type,

                parent:
                    parent ||
                    "module.exports",

                file:
                    filePath,

                line:
                    property.loc?.start?.line ||
                    line
            };


            collectSignature(
                api,
                rhs
            );


            addApi(api);
        }
    }


    function emitNamedExport(
        name,
        rhs,
        line,
        owner
    ) {

        if (!name) {
            return;
        }


        const type =
            getRhsType(
                rhs
            );


        const api = {

            name,

            type,

            kind:
                type,

            parent:
                owner ||
                "module.exports",

            file:
                filePath,

            line
        };


        collectSignature(
            api,
            rhs
        );


        addApi(api);
    }


    // ------------------------------------------------
    // Assignment handling
    // ------------------------------------------------

    function handleAssignment(
        expr,
        line
    ) {

        const left =
            expr.left;

        const right =
            expr.right;


        // --------------------------------------------
        // Primary export:
        //   module.exports = X
        //   exports = module.exports = X
        // --------------------------------------------

        if (
            isPrimaryExportTarget(
                left
            )
        ) {

            emitPrimaryExport(
                unwrapAssignmentRhs(
                    right
                ),
                line
            );

            return;
        }


        // --------------------------------------------
        // Named export / method
        //   module.exports.foo = X
        //   exports.foo = X
        //   app.get = function {}
        // --------------------------------------------

        if (
            left.type ===
            "MemberExpression"
        ) {

            const owner =
                left.object;

            const name =
                getMemberName(
                    left
                );

            if (
                name &&
                isModuleExportsRef(
                    owner
                )
            ) {

                emitNamedExport(
                    name,
                    right,
                    line,
                    getOwnerName(
                        owner
                    )
                );
            }
        }
    }


    // ------------------------------------------------
    // Traversal
    // ------------------------------------------------

    function walk(node) {

        if (
            !node ||
            typeof node !== "object"
        ) {
            return;
        }


        if (!node.type) {
            return;
        }


        // --------------------------------------------
        // Collect declared functions (hoisted lookup)
        // --------------------------------------------

        if (
            node.type ===
            "FunctionDeclaration"
        ) {

            if (node.id?.name) {

                declaredFunctions.add(
                    node.id.name
                );
            }
        }


        // --------------------------------------------
        // Alias declarations
        //   var app = exports = module.exports = {}
        // --------------------------------------------

        if (
            node.type ===
            "VariableDeclaration"
        ) {

            for (
                const declaration
                of node.declarations || []
            ) {

                const name =
                    declaration.id?.name;

                const init =
                    declaration.init;

                if (!name || !init) {
                    continue;
                }


                if (
                    init.type ===
                    "AssignmentExpression" &&
                    chainAssignsExport(
                        init
                    )
                ) {

                    moduleAliases.add(
                        name
                    );

                    if (
                        isPrimaryExportTarget(
                            init.left
                        )
                    ) {

                        emitPrimaryExport(
                            unwrapAssignmentRhs(
                                init
                            ),
                            declaration.loc?.start?.line ||
                            line
                        );
                    }
                }
            }
        }


        // --------------------------------------------
        // Assignments
        // --------------------------------------------

        if (
            node.type ===
            "ExpressionStatement"
        ) {

            const expression =
                node.expression;

            if (
                expression?.type ===
                "AssignmentExpression"
            ) {

                handleAssignment(
                    expression,
                    node.loc?.start?.line
                );
            }
        }


        // --------------------------------------------
        // Continue traversal
        // --------------------------------------------

        for (
            const key
            of Object.keys(node)
        ) {

            if (
                key === "loc" ||
                key === "start" ||
                key === "end" ||
                key === "range" ||
                key === "extra"
            ) {
                continue;
            }


            const value =
                node[key];


            if (Array.isArray(value)) {

                for (
                    const child
                    of value
                ) {

                    if (
                        child &&
                        typeof child === "object"
                    ) {
                        walk(child);
                    }
                }
            }
            else if (
                value &&
                typeof value === "object"
            ) {
                walk(value);
            }
        }
    }


    walk(ast);

    return exports;
}


/**
 * Extract exports from one package source file.
 *
 * We intentionally keep this simple initially.
 */
// --------------------------------------------------
// Extract package APIs
// --------------------------------------------------

function extractPackageExports(
    ast,
    filePath
) {

    const exports = [];


    function addExport(api) {

        const duplicate =
            exports.some(
                (existing) =>
                    existing.name === api.name &&
                    existing.type === api.type &&
                    existing.kind === api.kind
            );


        if (!duplicate) {
            exports.push(api);
        }
    }


    function visit(node) {

        if (
            !node ||
            typeof node !== "object"
        ) {
            return;
        }


        if (!node.type) {
            return;
        }


        // ==================================================
        // Export named declaration
        // ==================================================

        if (
            node.type ===
            "ExportNamedDeclaration"
        ) {

            const declaration =
                node.declaration;


            // ---------------------------------------------
            // export function foo()
            // ---------------------------------------------

            if (
                declaration?.type ===
                "FunctionDeclaration"
            ) {

                if (declaration.id?.name) {

                    addExport({

                        name:
                            declaration.id.name,

                        type:
                            "function",

                        kind:
                            "function",

                        parameters:
                            getFunctionParameters(
                                declaration
                            ),

                        returnType:
                            getReturnType(
                                declaration
                            ),

                        file:
                            filePath,

                        line:
                            declaration.loc?.start?.line
                    });
                }
            }


            // ---------------------------------------------
            // export class Foo
            // ---------------------------------------------

            else if (
                declaration?.type ===
                "ClassDeclaration"
            ) {

                if (declaration.id?.name) {

                    addExport({

                        name:
                            declaration.id.name,

                        type:
                            "class",

                        kind:
                            "class",

                        methods:
                            extractClassMethods(
                                declaration,
                                filePath
                            ),

                        file:
                            filePath,

                        line:
                            declaration.loc?.start?.line
                    });
                }
            }


            // ---------------------------------------------
            // export const foo
            // ---------------------------------------------

            else if (
                declaration?.declarations
            ) {

                for (
                    const declarator
                    of declaration.declarations
                ) {

                    if (
                        !declarator.id?.name
                    ) {
                        continue;
                    }


                    addExport({

                        name:
                            declarator.id.name,

                        type:
                            "variable",

                        kind:
                            "variable",

                        file:
                            filePath,

                        line:
                            declarator.loc?.start?.line
                    });
                }
            }


            // ---------------------------------------------
            // export interface Foo
            // ---------------------------------------------

            else if (
                declaration?.type ===
                "TSInterfaceDeclaration"
            ) {

                if (
                    declaration.id?.name
                ) {

                    addExport({

                        name:
                            declaration.id.name,

                        type:
                            "interface",

                        kind:
                            "interface",

                        members:
                            extractInterfaceMembers(
                                declaration,
                                filePath
                            ),

                        file:
                            filePath,

                        line:
                            declaration.loc?.start?.line
                    });
                }
            }


            // ---------------------------------------------
            // export type Foo
            // ---------------------------------------------

            else if (
                declaration?.type ===
                "TSTypeAliasDeclaration"
            ) {

                if (
                    declaration.id?.name
                ) {

                    addExport({

                        name:
                            declaration.id.name,

                        type:
                            "type",

                        kind:
                            "type",

                        file:
                            filePath,

                        line:
                            declaration.loc?.start?.line
                    });
                }
            }


            // ---------------------------------------------
            // export { foo, bar }
            // ---------------------------------------------

            for (
                const specifier
                of node.specifiers || []
            ) {

                const exportedName =
                    specifier.exported?.name ||
                    specifier.exported?.value;


                if (!exportedName) {
                    continue;
                }


                addExport({

                    name:
                        exportedName,

                    type:
                        "named",

                    kind:
                        "re-export",

                    file:
                        filePath,

                    line:
                        specifier.loc?.start?.line
                });
            }
        }


        // ==================================================
        // Export default
        // ==================================================

        if (
            node.type ===
            "ExportDefaultDeclaration"
        ) {

            const declaration =
                node.declaration;


            if (
                declaration?.type ===
                "FunctionDeclaration"
            ) {

                addExport({

                    name:
                        "default",

                    type:
                        "function",

                    kind:
                        "function",

                    parameters:
                        getFunctionParameters(
                            declaration
                        ),

                    returnType:
                        getReturnType(
                            declaration
                        ),

                    file:
                        filePath,

                    line:
                        node.loc?.start?.line
                });

            }

            else if (
                declaration?.type ===
                "ClassDeclaration"
            ) {

                addExport({

                    name:
                        "default",

                    type:
                        "class",

                    kind:
                        "class",

                    methods:
                        extractClassMethods(
                            declaration,
                            filePath
                        ),

                    file:
                        filePath,

                    line:
                        node.loc?.start?.line
                });

            }

            else {

                addExport({

                    name:
                        "default",

                    type:
                        "default",

                    kind:
                        declaration?.type ||
                        "unknown",

                    file:
                        filePath,

                    line:
                        node.loc?.start?.line
                });
            }
        }


        // ==================================================
        // Continue traversal
        // ==================================================

        for (
            const key
            of Object.keys(node)
        ) {

            if (
                key === "loc" ||
                key === "start" ||
                key === "end" ||
                key === "range" ||
                key === "extra"
            ) {
                continue;
            }


            const value =
                node[key];


            if (Array.isArray(value)) {

                for (
                    const child
                    of value
                ) {

                    if (
                        child &&
                        typeof child === "object"
                    ) {

                        visit(child);
                    }
                }

            }

            else if (
                value &&
                typeof value === "object"
            ) {

                visit(value);
            }
        }
    }


    visit(ast);


    // ------------------------------------------------
    // CommonJS exports
    //
    // Packages such as Express expose APIs through
    // module.exports / exports assignment instead of
    // ESM export statements. Merge those in so the
    // API surface is not reported as empty.
    // ------------------------------------------------

    const commonJsExports =
        extractCommonJsExports(
            ast,
            filePath
        );


    for (
        const api
        of commonJsExports
    ) {
        addExport(api);
    }


    return exports;
}


/**
 * Analyze a package that has already been extracted.
 */
function analyzePackageDirectory(
    packageRoot
) {

    const packageJson =
        readPackageManifest(
            packageRoot
        );


    const entryPoints =
        extractPackageEntryPoints(
            packageRoot,
            packageJson
        );


    const sourceFiles =
        getPackageSourceFiles(
            packageRoot
        );


    const exports = [];


    // --------------------------------------------------
    // Analyze entry points first
    // --------------------------------------------------

    const analyzedFiles =
        new Set();


    for (
        const entryPoint
        of entryPoints
    ) {

        if (
            !fs.existsSync(
                entryPoint
            )
        ) {
            continue;
        }


        const stat =
            fs.statSync(
                entryPoint
            );


        if (!stat.isFile()) {
            continue;
        }


        const extension =
            path.extname(
                entryPoint
            ).toLowerCase();


        if (
            ![
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".mjs",
                ".cjs"
            ].includes(extension)
        ) {
            continue;
        }


        analyzedFiles.add(
            entryPoint
        );


        const ast =
            parseSourceFile(
                entryPoint
            );


        if (!ast) {
            continue;
        }


        // --------------------------------------------------
        // Declaration file
        // --------------------------------------------------

        if (
            entryPoint.endsWith(
                ".d.ts"
            )
        ) {

            const declarationApis =
                extractDeclarationApis(
                    ast,
                    entryPoint
                );


            exports.push(
                ...declarationApis
            );

        }

        // --------------------------------------------------
        // JavaScript / TypeScript source
        // --------------------------------------------------

        else {

            const fileExports =
                extractPackageExports(
                    ast,
                    entryPoint
                );


            exports.push(
                ...fileExports
            );
        }
    }


    // --------------------------------------------------
    // Analyze remaining source files
    //
    // This gives us more coverage when the package
    // doesn't expose everything through a simple entry
    // point.
    // --------------------------------------------------

    for (
        const file
        of sourceFiles
    ) {

        if (
            analyzedFiles.has(
                file
            )
        ) {
            continue;
        }


        const ast =
            parseSourceFile(
                file
            );


        if (!ast) {
            continue;
        }


        // --------------------------------------------------
        // TypeScript declaration file
        // --------------------------------------------------

        if (
            file.endsWith(
                ".d.ts"
            )
        ) {

            const declarationApis =
                extractDeclarationApis(
                    ast,
                    file
                );


            exports.push(
                ...declarationApis
            );
        }

        // --------------------------------------------------
        // Normal source file
        // --------------------------------------------------

        else {

            const fileExports =
                extractPackageExports(
                    ast,
                    file
                );


            exports.push(
                ...fileExports
            );
        }
    }


    return {

        packageJson,

        entryPoints,

        sourceFiles,

        exports
    };
}

/**
 * Download/extract an exact npm package version.
 *
 * Example:
 *
 * prisma@7.9.1
 *
 * npm pack produces:
 *
 * prisma-7.9.1.tgz
 */
function downloadPackageVersion(
    packageName,
    version
) {

    const availableVersion =
        checkPackageVersion(
            packageName,
            version
        );


    if (!availableVersion) {

        throw new Error(
            `${packageName}@${version} does not exist on npm`
        );
    }


    const tempDirectory =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "devtimeline-"
            )
        );


    try {

        // ---------------------------------------------
        // Download package tarball
        // ---------------------------------------------

        const command =
            `npm pack ${packageName}@${version} --pack-destination "${tempDirectory}"`;

        execSync(
            command,
            {
                stdio: "pipe",
                shell: true
            }
        );


        // ---------------------------------------------
        // Find generated .tgz file
        // ---------------------------------------------

        const files =
            fs.readdirSync(
                tempDirectory
            );


        const tarball =
            files.find(
                (file) =>
                    file.endsWith(".tgz")
            );


        if (!tarball) {

            throw new Error(
                `npm pack did not produce a tarball for ${packageName}@${version}`
            );
        }


        const tarballPath =
            path.join(
                tempDirectory,
                tarball
            );


        // ---------------------------------------------
        // Extract package
        // ---------------------------------------------

        const packageDirectory =
            path.join(
                tempDirectory,
                "package"
            );


        fs.mkdirSync(
            packageDirectory,
            {
                recursive: true
            }
        );


        execSync(
            `tar -xzf "${tarballPath}" -C "${tempDirectory}"`,
            {
                stdio: "pipe",
                shell: true
            }
        );


        // ---------------------------------------------
        // Verify extraction
        // ---------------------------------------------

        if (
            !fs.existsSync(
                packageDirectory
            )
        ) {

            throw new Error(
                `Package extraction failed for ${packageName}@${version}`
            );
        }


        return {

            tempDirectory,

            packageDirectory
        };

    }
    catch (error) {

        fs.rmSync(
            tempDirectory,
            {
                recursive: true,
                force: true
            }
        );


        throw new Error(
            `Unable to download ${packageName}@${version}: ${error.message}`
        );
    }
}

// --------------------------------------------------
// Read package.json
// --------------------------------------------------

function readPackageManifest(packageRoot) {

    const packageJsonPath =
        path.join(
            packageRoot,
            "package.json"
        );

    if (!fs.existsSync(packageJsonPath)) {
        return null;
    }

    try {

        return JSON.parse(
            fs.readFileSync(
                packageJsonPath,
                "utf8"
            )
        );

    }
    catch (error) {

        console.warn(
            `Could not read package.json: ${error.message}`
        );

        return null;
    }
}

function extractPackageMetadata(
    packageRoot
) {

    const packageJson =
        readPackageManifest(
            packageRoot
        );


    if (!packageJson) {

        return {

            name: null,

            version: null,

            description: null,

            repository: null,

            homepage: null,

            bugs: null
        };
    }


    return {

        name:
            packageJson.name ||
            null,

        version:
            packageJson.version ||
            null,

        description:
            packageJson.description ||
            null,

        repository:
            packageJson.repository ||
            null,

        homepage:
            packageJson.homepage ||
            null,

        bugs:
            packageJson.bugs ||
            null
    };
}


// --------------------------------------------------
// Resolve package exports
// --------------------------------------------------

function extractPackageEntryPoints(
    packageRoot,
    packageJson
) {

    const entryPoints = [];

    if (!packageJson) {
        return entryPoints;
    }

    function addEntryPoint(relativePath) {

        if (!relativePath || typeof relativePath !== "string") {
            return;
        }

        if (relativePath === "./package.json") {
            return;
        }

        const absolutePath = path.resolve(
            packageRoot,
            relativePath
        );

        // Direct file
        if (fs.existsSync(absolutePath)) {

            const stat = fs.statSync(absolutePath);

            if (stat.isFile()) {
                entryPoints.push(absolutePath);
                return;
            }
        }

        // Try common extensions
        const extensions = [
            ".js",
            ".mjs",
            ".cjs",
            ".jsx",
            ".ts",
            ".tsx",
            ".d.ts"
        ];

        for (const extension of extensions) {

            const candidate =
                absolutePath + extension;

            if (fs.existsSync(candidate)) {

                const stat =
                    fs.statSync(candidate);

                if (stat.isFile()) {
                    entryPoints.push(candidate);
                    return;
                }
            }
        }

        // Try directory/index.*
        if (fs.existsSync(absolutePath)) {

            const stat =
                fs.statSync(absolutePath);

            if (stat.isDirectory()) {

                for (const extension of extensions) {

                    const indexFile =
                        path.join(
                            absolutePath,
                            `index${extension}`
                        );

                    if (fs.existsSync(indexFile)) {

                        entryPoints.push(indexFile);

                        return;
                    }
                }
            }
        }
    }

    // --------------------------------------------------
    // Modern "exports"
    // --------------------------------------------------

    const exportsField =
        packageJson.exports;

    if (typeof exportsField === "string") {

        addEntryPoint(exportsField);

    } else if (
        exportsField &&
        typeof exportsField === "object"
    ) {

        const collectedPaths = [];

        collectExportPaths(
            packageRoot,
            exportsField,
            collectedPaths
        );

        for (const file of collectedPaths) {
            addEntryPoint(
                path.relative(
                    packageRoot,
                    file
                )
            );
        }
    }

    // --------------------------------------------------
    // Traditional "main"
    // --------------------------------------------------

    if (packageJson.main) {
        addEntryPoint(packageJson.main);
    }

    // --------------------------------------------------
    // TypeScript declarations
    // --------------------------------------------------

    if (packageJson.types) {
        addEntryPoint(packageJson.types);
    }

    if (packageJson.typings) {
        addEntryPoint(packageJson.typings);
    }

    // --------------------------------------------------
    // Common fallback locations
    // --------------------------------------------------

    const fallbackPaths = [
        "index.js",
        "index.mjs",
        "index.cjs",
        "lib/index.js",
        "src/index.js",
        "dist/index.js"
    ];

    for (const fallback of fallbackPaths) {
        addEntryPoint(fallback);
    }

    return [
        ...new Set(entryPoints)
    ];
}


// --------------------------------------------------
// Recursively collect paths from "exports"
// --------------------------------------------------

function collectExportPaths(
    packageRoot,
    value,
    entryPoints
) {

    if (typeof value === "string") {

        // Ignore package.json itself.
        if (value === "./package.json") {
            return;
        }

        entryPoints.push(
            path.resolve(
                packageRoot,
                value.replace(
                    /^\.\//,
                    ""
                )
            )
        );

        return;
    }


    if (!value || typeof value !== "object") {
        return;
    }


    for (const child of Object.values(value)) {

        collectExportPaths(
            packageRoot,
            child,
            entryPoints
        );
    }
}

function readPackageDocumentation(
    packageDirectory,
    packageName = null,
    packageVersion = null
) {

    const possibleFiles = [

        "CHANGELOG.md",
        "CHANGELOG",
        "changelog.md",

        "HISTORY.md",
        "HISTORY",

        "README.md"
    ];


    const documentation = [];


    for (
        const fileName
        of possibleFiles
    ) {

        const filePath =
            path.join(
                packageDirectory,
                fileName
            );


        if (
            !fs.existsSync(
                filePath
            )
        ) {
            continue;
        }


        const stat =
            fs.statSync(
                filePath
            );


        if (!stat.isFile()) {
            continue;
        }


        try {

            const content =
                fs.readFileSync(
                    filePath,
                    "utf8"
                );


            documentation.push({

                file:
                    fileName,

                content,

                package:
                    packageName,

                version:
                    packageVersion,

                type:
                    "documentation"
            });

        }
        catch {
            // Ignore unreadable documentation files
        }
    }


    return documentation;
}

/**
 * Analyze one exact package version.
 */
function analyzePackageVersion(
    packageName,
    version
) {

    const downloaded =
        downloadPackageVersion(
            packageName,
            version
        );


    try {

        // --------------------------------------------------
        // Analyze package source
        // --------------------------------------------------

        const analysis =
            analyzePackageDirectory(
                downloaded.packageDirectory
            );


        // --------------------------------------------------
        // Convert entry points to package-relative paths
        // --------------------------------------------------

        const entryPoints =
            analysis.entryPoints.map(
                (file) =>
                    path.relative(
                        downloaded.packageDirectory,
                        file
                    ).replace(
                        /\\/g,
                        "/"
                    )
            );


        // --------------------------------------------------
        // Convert API file paths to package-relative paths
        // --------------------------------------------------

        const exports =
            analysis.exports.map(
                (item) => ({

                    ...item,

                    file:
                        path.relative(
                            downloaded.packageDirectory,
                            item.file
                        ).replace(
                            /\\/g,
                            "/"
                        )
                })
            );


        // --------------------------------------------------
        // Read package metadata
        // --------------------------------------------------

        const metadata =
            extractPackageMetadata(
                downloaded.packageDirectory
            );


        // --------------------------------------------------
        // Read README / CHANGELOG / HISTORY
        // --------------------------------------------------

        const documentation =
            readPackageDocumentation(
                downloaded.packageDirectory,
                packageName,
                version
            );


        // --------------------------------------------------
        // Return complete snapshot
        // --------------------------------------------------

        return {

            package:
                packageName,

            version,

            entryPoints,

            exports,

            sourceFileCount:
                analysis.sourceFiles.length,

            metadata,

            documentation
        };

    }

    finally {

        // --------------------------------------------------
        // Delete temporary package
        // --------------------------------------------------

        fs.rmSync(
            downloaded.tempDirectory,
            {
                recursive: true,
                force: true
            }
        );
    }
}

function checkPackageVersion(
    packageName,
    version
) {

    try {

        const output =
            execSync(
                `npm view ${packageName}@${version} version`,
                {
                    encoding: "utf8",
                    stdio: ["pipe", "pipe", "pipe"],
                    shell: true
                }
            );

        return output.trim();

    }
    catch {

        return null;
    }
}


export {
    getPackageSourceFiles,
    extractPackageExports,
    extractCommonJsExports,
    extractDeclarationApis,
    analyzePackageDirectory,
    downloadPackageVersion,
    analyzePackageVersion,
    readPackageManifest,
    extractPackageEntryPoints,
    extractPackageMetadata,
    readPackageDocumentation,
};