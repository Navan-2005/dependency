import "dotenv/config";

import {
    buildPackageKnowledge
} from "./service/rag/packageKnowledge.js";

import {
    retrieveUpgradeEvidence
} from "./service/rag/upgradeRetriever.js";


// --------------------------------------------------
// Configuration
// --------------------------------------------------

const PACKAGE_NAME = "express";

const OLD_VERSION = "4.21.2";

const NEW_VERSION = "5.2.1";


// --------------------------------------------------
// Test API diff
// --------------------------------------------------

const apiDiff = {

    added: [],

    removed: [],

    modified: [
        {
            name: "Router",
            parent: null,
            className: null
        }
    ],

    unchanged: []
};


// --------------------------------------------------
// Documentation
// --------------------------------------------------
//
// IMPORTANT:
//
// documentChunker.js expects an ARRAY.
// --------------------------------------------------

const documentation = [
    {
        file: "README.md",
        content: `
Express is a fast, unopinionated, minimalist web framework
for Node.js.

Express provides routing and middleware functionality.

The Router object is used to create modular route handlers.
`,
        package: PACKAGE_NAME,
        version: NEW_VERSION,
        type: "documentation"
    },

    {
        file: "CHANGELOG.md",
        content: `
Express 5 migration information.

Express 5 includes changes to routing and middleware behavior.
Review the migration guide when upgrading from Express 4.
`,
        package: PACKAGE_NAME,
        version: NEW_VERSION,
        type: "documentation"
    }
];


// --------------------------------------------------
// Package snapshot
// --------------------------------------------------

const snapshot = {

    package: PACKAGE_NAME,

    version: NEW_VERSION,

    documentation

};


// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {

    console.log(
        "\n=========================================="
    );

    console.log(
        "RAG UPGRADE RETRIEVAL TEST"
    );

    console.log(
        "==========================================\n"
    );


    console.log(
        `Package: ${PACKAGE_NAME}`
    );

    console.log(
        `Version: ${OLD_VERSION} → ${NEW_VERSION}`
    );


    // --------------------------------------------------
    // Build knowledge
    // --------------------------------------------------

    console.log(
        "\nBuilding package knowledge..."
    );


    const knowledge =
        await buildPackageKnowledge(
            snapshot
        );


    console.log(
        "Knowledge base created."
    );


    // --------------------------------------------------
    // Retrieve evidence
    // --------------------------------------------------

    console.log(
        "\nRetrieving upgrade evidence..."
    );


    const evidence =
        await retrieveUpgradeEvidence({

            packageName:
                PACKAGE_NAME,

            oldVersion:
                OLD_VERSION,

            newVersion:
                NEW_VERSION,

            apiDiff,

            knowledge,

            limitPerApi: 3
        });


    // --------------------------------------------------
    // Print retrieval results
    // --------------------------------------------------

    console.log(
        "\n=========================================="
    );

    console.log(
        "RETRIEVAL RESULTS"
    );

    console.log(
        "==========================================\n"
    );


    for (
        const item
        of evidence
    ) {

        console.log(
            `API: ${item.api}`
        );

        console.log(
            `Change type: ${item.changeType}`
        );


        console.log(
            "\nQueries:"
        );


        for (
            const query
            of item.queries || []
        ) {

            console.log(
                `  - ${query}`
            );
        }


        console.log(
            "\nRetrieved evidence:"
        );


        if (
            !item.results ||
            item.results.length === 0
        ) {

            console.log(
                "  No results found."
            );

            continue;
        }


        item.results.forEach(
            (result, index) => {

                console.log(
                    `\n  Result ${index + 1}`
                );

                console.log(
                    `  Source: ${result.source}`
                );

                console.log(
                    `  Score: ${result.score}`
                );

                console.log(
                    `  Package: ${result.package}`
                );

                console.log(
                    `  Version: ${result.version}`
                );

                console.log(
                    `  Type: ${result.type}`
                );

                console.log(
                    "\n  Content:"
                );

                console.log(
                    "  --------------------------------------"
                );

                console.log(
                    result.content
                );

                console.log(
                    "  --------------------------------------"
                );
            }
        );
    }


    // --------------------------------------------------
    // Raw JSON
    // --------------------------------------------------

    console.log(
        "\n=========================================="
    );

    console.log(
        "RAW EVIDENCE JSON"
    );

    console.log(
        "==========================================\n"
    );


    console.log(
        JSON.stringify(
            evidence,
            null,
            2
        )
    );
}


// --------------------------------------------------
// Execute
// --------------------------------------------------

main()
    .catch(error => {

        console.error(
            "\nRAG test failed:"
        );

        console.error(
            error
        );

        process.exit(
            1
        );
    });