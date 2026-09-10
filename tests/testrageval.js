import "dotenv/config";

import {
    analyzePackageVersion
} from "../server/service/packageApiAnalyzer.js";

import {
    buildPackageKnowledge
} from "../server/service/rag/packageKnowledge.js";

import {
    evaluateRag,
    summarizeEvaluation
} from "../server/service/rag/ragEvaluator.js";


const PACKAGE_NAME = "express";
const OLD_VERSION = "4.21.2";
const NEW_VERSION = "5.2.1";


async function main() {

    console.log(
        `Analyzing ${PACKAGE_NAME}@${NEW_VERSION}...`
    );

    const snapshot =
        await analyzePackageVersion(
            PACKAGE_NAME,
            NEW_VERSION
        );

    console.log(
        "Documentation files:",
        snapshot.documentation?.length || 0
    );

    const knowledge =
        await buildPackageKnowledge(
            snapshot
        );

    console.log(
        "Chunks:",
        knowledge.chunks.length
    );

    const tests = [
        {
            package: PACKAGE_NAME,
            from: OLD_VERSION,
            to: NEW_VERSION,

            api: "Router",

            apiDiff: {
                added: [],
                removed: [],
                modified: [
                    {
                        name: "Router"
                    }
                ],
                unchanged: []
            },

            expectedSources: [
                "README.md"
            ],

            expectedTerms: [
                "migration",
                "v5"
            ],

            limit: 3
        }
    ];

    const results =
        await evaluateRag(
            tests,
            knowledge
        );

    console.log(
        "\n========== RAG RESULTS ==========\n"
    );

    console.dir(
        results,
        { depth: null }
    );

    const summary =
        summarizeEvaluation(
            results
        );

    console.log(
        "\n========== SUMMARY ==========\n"
    );

    console.table(
        summary
    );
}


main().catch(
    error => {
        console.error(error);
        process.exit(1);
    }
);