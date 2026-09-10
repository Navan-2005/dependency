import "dotenv/config";

import {
    analyzePackageVersion
} from "../server/service/packageApiAnalyzer.js";

import {
    buildPackageKnowledge,
    searchPackageKnowledge
} from "../server/service/rag/packageKnowledge.js";


const packageName =
    "express";

const version =
    "5.2.1";


console.log(
    `Analyzing ${packageName}@${version}...`
);


const snapshot =
    await analyzePackageVersion(
        packageName,
        version
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


console.log(
    "Vector store:",
    knowledge.vectorStore.size()
);


const results =
    await searchPackageKnowledge(
        knowledge,

        "Express 5 router changes migration breaking changes",

        5
    );


console.log(
    "\n=== RELEVANT DOCUMENTATION ===\n"
);


for (const result of results) {

    console.log(
        "Score:",
        result.score.toFixed(4)
    );

    console.log(
        "Source:",
        result.source
    );

    console.log(
        result.content
    );

    console.log(
        "\n-----------------------------\n"
    );
}