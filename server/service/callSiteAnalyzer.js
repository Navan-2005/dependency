import { parse } from "@babel/parser";
import fs from "fs";


function getArgumentText(argument, code) {

    if (!argument) {
        return null;
    }

    try {
        return code.slice(
            argument.start,
            argument.end
        );
    } catch {
        return null;
    }
}


function getCallArguments(callNode, code) {

    if (!callNode.arguments) {
        return [];
    }

    return callNode.arguments.map(
        argument =>
            getArgumentText(
                argument,
                code
            )
    );
}


function getCalleeName(node) {

    if (!node) {
        return null;
    }


    /*
     * jwt.verify
     */

    if (
        node.type ===
        "MemberExpression"
    ) {

        const object =
            getCalleeName(
                node.object
            );

        const property =
            node.computed
                ? null
                : node.property?.name;


        if (
            object &&
            property
        ) {

            return `${object}.${property}`;
        }
    }


    /*
     * verify()
     */

    if (
        node.type ===
        "Identifier"
    ) {

        return node.name;
    }


    return null;
}


function traverse(
    node,
    visitor
) {

    if (!node) {
        return;
    }


    if (
        typeof node !==
        "object"
    ) {
        return;
    }


    if (
        typeof node.type ===
        "string"
    ) {

        visitor(node);
    }


    for (
        const key of
        Object.keys(node)
    ) {

        /*
         * Don't traverse Babel
         * location metadata.
         */

        if (
            key === "loc" ||
            key === "start" ||
            key === "end" ||
            key === "extra"
        ) {
            continue;
        }


        const value =
            node[key];


        if (
            Array.isArray(value)
        ) {

            for (
                const child of value
            ) {

                traverse(
                    child,
                    visitor
                );
            }

        } else if (
            value &&
            typeof value ===
                "object"
        ) {

            traverse(
                value,
                visitor
            );
        }
    }
}


function analyzeCallSites(
    file,
    code
) {

        const ast =
            parse(
                code,
                {
                    sourceType:
                        "unambiguous",

                    plugins: [
                        "jsx",
                        "typescript"
                    ],

                    ranges: true,
                    locations: true
                }
            );


    const calls = [];


    traverse(
        ast,
        node => {

            if (
                node.type !==
                "CallExpression"
            ) {
                return;
            }


            const callee =
                getCalleeName(
                    node.callee
                );


            if (!callee) {
                return;
            }


            const line =
                node.loc?.start?.line
                ?? null;


            calls.push({

                callee,

                line,

                argumentCount:
                    node.arguments?.length
                    ?? 0,

                arguments:
                    getCallArguments(
                        node,
                        code
                    )
            });
        }
    );


    return calls;
}


function analyzeFileCallSites(
    filePath
) {

    const code =
        fs.readFileSync(
            filePath,
            "utf8"
        );


    return analyzeCallSites(
        filePath,
        code
    );
}


export {
    analyzeCallSites,
    analyzeFileCallSites,
    getCalleeName,
    getArgumentText,
    getCallArguments
};