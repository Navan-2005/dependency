import {
    analyzeJavaScript
} from "../server/controller/repo.js";

import {
    analyzePackageVersion
} from "../server/service/packageApiAnalyzer.js";

import {
    diffApiSnapshots
} from "../server/service/apiDiff.js";

import {
    generateImpactReport
} from "../server/service/apiImpactMatcher.js";


const repoPath =
    "../repos/Trade_book";


const packageName =
    "@prisma/client";


const oldVersion =
    "7.9.1";


const newVersion =
    "7.10.0";


console.log(
    "Analyzing repository..."
);

const repositoryAnalysis =
    await analyzeJavaScript(
        repoPath
    );


console.log(
    "Analyzing old package..."
);

const oldSnapshot =
    await analyzePackageVersion(
        packageName,
        oldVersion
    );


console.log(
    "Analyzing new package..."
);

const newSnapshot =
    await analyzePackageVersion(
        packageName,
        newVersion
    );


console.log(
    "Comparing APIs..."
);

const apiDiff =
    diffApiSnapshots(
        oldSnapshot,
        newSnapshot
    );

    console.log("\n========== API DIFF SUMMARY ==========");

console.dir(
    apiDiff.summary,
    {
        depth: null
    }
);


console.log("\n========== REMOVED APIs ==========");

console.dir(
    apiDiff.removed,
    {
        depth: 4
    }
);


console.log("\n========== MODIFIED APIs ==========");

console.dir(
    apiDiff.modified,
    {
        depth: 6
    }
);


console.log("\n========== REPOSITORY @prisma/client USAGES ==========");

const prismaUsages =
    repositoryAnalysis.files
        .flatMap(file =>
            (file.apiUsages || [])
                .filter(
                    usage =>
                        usage.package ===
                        "@prisma/client"
                )
                .map(
                    usage => ({
                        file: file.file,
                        ...usage
                    })
                )
        );


console.dir(
    prismaUsages,
    {
        depth: null
    }
);


console.log(
    "Finding repository impacts..."
);

const report =
    generateImpactReport(
        repositoryAnalysis,
        apiDiff,
        packageName
    );


console.dir(
    report,
    {
        depth: null
    }
);