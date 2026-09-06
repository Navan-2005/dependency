// service/exportResolver.js

function getLine(node) {
    return node.loc?.start?.line ?? null;
}

function extractExports(ast) {
    const exports = [];

    function visit(node) {
        if (!node || typeof node !== "object") {
            return;
        }

        if (Array.isArray(node)) {
            for (const item of node) {
                visit(item);
            }
            return;
        }

        if (typeof node.type !== "string") {
            return;
        }

        // --------------------------------------------------
        // export const foo = ...
        // export let foo = ...
        // export var foo = ...
        // --------------------------------------------------

        if (
            node.type === "ExportNamedDeclaration" &&
            node.declaration
        ) {
            const declaration = node.declaration;

            if (
                declaration.type === "VariableDeclaration"
            ) {
                for (const declarator of declaration.declarations) {
                    if (declarator.id?.type === "Identifier") {
                        exports.push({
                            name: declarator.id.name,
                            type: "variable",
                            line: getLine(declarator)
                        });
                    }
                }
            }

            // ----------------------------------------------
            // export function foo() {}
            // ----------------------------------------------

            else if (
                declaration.type === "FunctionDeclaration"
            ) {
                if (declaration.id) {
                    exports.push({
                        name: declaration.id.name,
                        type: "function",
                        line: getLine(declaration)
                    });
                }
            }

            // ----------------------------------------------
            // export class Foo {}
            // ----------------------------------------------

            else if (
                declaration.type === "ClassDeclaration"
            ) {
                if (declaration.id) {
                    exports.push({
                        name: declaration.id.name,
                        type: "class",
                        line: getLine(declaration)
                    });
                }
            }
        }

        // --------------------------------------------------
        // export { foo, bar }
        // --------------------------------------------------

        if (
            node.type === "ExportNamedDeclaration" &&
            node.specifiers
        ) {
            for (const specifier of node.specifiers) {
                if (
                    specifier.type === "ExportSpecifier"
                ) {
                    exports.push({
                        name: specifier.exported.name,
                        local: specifier.local.name,
                        type: "re-export",
                        line: getLine(specifier)
                    });
                }
            }
        }

        // --------------------------------------------------
        // export default ...
        // --------------------------------------------------

        if (
            node.type === "ExportDefaultDeclaration"
        ) {
            const declaration = node.declaration;

            let type = "default";

            if (declaration?.type === "FunctionDeclaration") {
                type = "function";
            } else if (
                declaration?.type === "ClassDeclaration"
            ) {
                type = "class";
            }

            exports.push({
                name: "default",
                type,
                line: getLine(node)
            });
        }

        // --------------------------------------------------
        // Safe recursive traversal
        // --------------------------------------------------

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

            if (value && typeof value === "object") {
                visit(value);
            }
        }
    }

    visit(ast);

    return exports;
}

export {
    extractExports
};