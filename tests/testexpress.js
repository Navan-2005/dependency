import { analyzePackageVersion } from "../server/service/packageApiAnalyzer.js";
import { diffApiSnapshots } from "../server/service/apiDiff.js";

const packageName = "express";

const oldVersion = "4.21.2";
const newVersion = "5.2.1";

console.log(`Analyzing ${packageName}@${oldVersion}...`);

const oldSnapshot = await analyzePackageVersion(
    packageName,
    oldVersion
);

console.log(`Analyzing ${packageName}@${newVersion}...`);

const newSnapshot = await analyzePackageVersion(
    packageName,
    newVersion
);

console.log("Comparing package APIs...");

console.log("\n=== OLD SNAPSHOT ===");

console.log(
    JSON.stringify(
        {
            package: oldSnapshot.package,
            version: oldSnapshot.version,
            entryPoints: oldSnapshot.entryPoints,
            exportCount: oldSnapshot.exports?.length || 0,
            exports: oldSnapshot.exports?.slice(0, 20) || []
        },
        null,
        2
    )
);

console.log("\n=== NEW SNAPSHOT ===");

console.log(
    JSON.stringify(
        {
            package: newSnapshot.package,
            version: newSnapshot.version,
            entryPoints: newSnapshot.entryPoints,
            exportCount: newSnapshot.exports?.length || 0,
            exports: newSnapshot.exports?.slice(0, 20) || []
        },
        null,
        2
    )
);

console.log("\n=== API DIFF ===");

const apiDiff = diffApiSnapshots(
    oldSnapshot,
    newSnapshot
);

console.log(
    JSON.stringify(apiDiff, null, 2)
);