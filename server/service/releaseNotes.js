import fs from "fs";
import path from "path";


// --------------------------------------------------
// Find common changelog files inside an npm package
// --------------------------------------------------

function findLocalChangelog(packageDirectory) {

    const possibleFiles = [

        "CHANGELOG.md",

        "CHANGELOG",

        "changelog.md",

        "HISTORY.md",

        "HISTORY",

        "README.md"
    ];


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
            fs.existsSync(
                filePath
            )
        ) {

            const stat =
                fs.statSync(
                    filePath
                );


            if (
                stat.isFile()
            ) {

                return filePath;
            }
        }
    }


    return null;
}


// --------------------------------------------------
// Read changelog
// --------------------------------------------------

function readChangelog(
    filePath
) {

    if (!filePath) {
        return null;
    }


    try {

        return fs.readFileSync(
            filePath,
            "utf8"
        );

    }
    catch {

        return null;
    }
}


// --------------------------------------------------
// Extract version sections
// --------------------------------------------------

function extractVersionSection(
    changelog,
    version
) {

    if (
        !changelog ||
        !version
    ) {

        return null;
    }


    const escapedVersion =
        version.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );


    const versionPattern =
        new RegExp(
            `^#{1,6}\\s*\\[?v?${escapedVersion}\\]?[^\\n]*\\n([\\s\\S]*?)(?=^#{1,6}\\s+|$)`,
            "im"
        );


    const match =
        changelog.match(
            versionPattern
        );


    if (!match) {
        return null;
    }


    return match[1].trim();
}


// --------------------------------------------------
// Extract breaking-change sections
// --------------------------------------------------

function extractBreakingChanges(
    text
) {

    if (!text) {
        return [];
    }


    const lines =
        text.split(
            /\r?\n/
        );


    const matches = [];


    let insideBreakingSection =
        false;


    for (
        const line
        of lines
    ) {

        const lower =
            line.toLowerCase();


        if (
            lower.includes(
                "breaking change"
            ) ||
            lower.includes(
                "breaking changes"
            ) ||
            lower.includes(
                "breaking"
            )
        ) {

            insideBreakingSection =
                true;


            matches.push(
                line.trim()
            );


            continue;
        }


        if (
            insideBreakingSection &&
            /^#{1,6}\s/.test(
                line
            )
        ) {

            insideBreakingSection =
                false;

            continue;
        }


        if (
            insideBreakingSection &&
            line.trim()
        ) {

            matches.push(
                line.trim()
            );
        }
    }


    return matches;
}


// --------------------------------------------------
// Search changelog for API names
// --------------------------------------------------

function findApiMentions(
    text,
    apiNames
) {

    if (
        !text ||
        !Array.isArray(
            apiNames
        )
    ) {

        return [];
    }


    const lines =
        text.split(
            /\r?\n/
        );


    const mentions = [];


    for (
        const apiName
        of apiNames
    ) {

        if (!apiName) {
            continue;
        }


        const matchingLines =
            lines.filter(
                line =>
                    line
                        .toLowerCase()
                        .includes(
                            apiName.toLowerCase()
                        )
            );


        if (
            matchingLines.length > 0
        ) {

            mentions.push({

                api:
                    apiName,

                lines:
                    matchingLines.slice(
                        0,
                        10
                    )
            });
        }
    }


    return mentions;
}


// --------------------------------------------------
// Build release-note evidence
// --------------------------------------------------

function buildReleaseEvidence(
    changelog,
    oldVersion,
    newVersion,
    changedApis
) {

    const oldSection =
        extractVersionSection(
            changelog,
            oldVersion
        );


    const newSection =
        extractVersionSection(
            changelog,
            newVersion
        );


    const targetSection =
        newSection ||
        changelog;


    const breakingChanges =
        extractBreakingChanges(
            targetSection
        );


    const apiMentions =
        findApiMentions(
            targetSection,
            changedApis
        );


    return {

        oldVersion,

        newVersion,

        versionSection:
            targetSection,

        breakingChanges,

        apiMentions
    };
}


// --------------------------------------------------
// Analyze local package changelog
// --------------------------------------------------

function analyzeLocalChangelog(
    packageDirectory,
    oldVersion,
    newVersion,
    changedApis
) {

    const changelogPath =
        findLocalChangelog(
            packageDirectory
        );


    if (!changelogPath) {

        return {

            found: false,

            path: null,

            evidence: null
        };
    }


    const changelog =
        readChangelog(
            changelogPath
        );


    if (!changelog) {

        return {

            found: false,

            path:
                changelogPath,

            evidence: null
        };
    }


    const evidence =
        buildReleaseEvidence(
            changelog,
            oldVersion,
            newVersion,
            changedApis
        );


    return {

        found: true,

        path:
            changelogPath,

        evidence
    };
}


export {

    findLocalChangelog,

    readChangelog,

    extractVersionSection,

    extractBreakingChanges,

    findApiMentions,

    buildReleaseEvidence,

    analyzeLocalChangelog
};