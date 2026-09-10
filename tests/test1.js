import {
    analyzePackageVersion
} from "../server/service/packageApiAnalyzer.js";

import {
    diffApiSnapshots
} from "../server/service/apiDiff.js";


console.log(
    "Analyzing old version..."
);


const oldSnapshot =
    analyzePackageVersion(
        "prisma",
        "7.9.1"
    );


console.log(
    "Analyzing new version..."
);


const newSnapshot =
    analyzePackageVersion(
        "prisma",
        "8.0.0-rc.13"
    );


console.log(
    "Comparing APIs..."
);


const diff =
    diffApiSnapshots(
        oldSnapshot,
        newSnapshot
    );


console.log(
    JSON.stringify(
        diff,
        null,
        2
    )
);