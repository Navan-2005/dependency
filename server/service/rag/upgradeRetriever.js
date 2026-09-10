import {
    searchPackageKnowledge
} from "./packageKnowledge.js";


const MIN_RELEVANCE_SCORE = 0.60;


// --------------------------------------------------
// API name
// --------------------------------------------------

function getApiName(api) {

    if (!api) {
        return "";
    }

    if (typeof api === "string") {
        return api;
    }

    if (api.parent && api.name) {
        return `${api.parent}.${api.name}`;
    }

    if (api.className && api.name) {
        return `${api.className}.${api.name}`;
    }

    return api.name || "";
}


// --------------------------------------------------
// Extract repository usage information
// --------------------------------------------------

function getUsageContext(
    impacts,
    apiName
) {

    if (!Array.isArray(impacts)) {
        return [];
    }


    return impacts
        .filter(
            impact =>
                impact?.api === apiName
        )
        .map(
            impact => {

                const usage =
                    impact.usage || {};

                return {

                    file:
                        impact.file ||
                        usage.file ||
                        null,

                    line:
                        impact.line ||
                        usage.line ||
                        null,

                    local:
                        impact.local ||
                        usage.local ||
                        null,

                    receiver:
                        impact.receiver ||
                        usage.receiver ||
                        null,

                    type:
                        impact.type ||
                        usage.type ||
                        null
                };
            }
        );
}


// --------------------------------------------------
// Build context-aware queries
// --------------------------------------------------

function buildQueries({
    packageName,
    oldVersion,
    newVersion,
    api,
    changeType,
    usageContext = []
}) {

    const apiName =
        getApiName(api);


    const queries = [];


    // ----------------------------------------------
    // Basic API migration query
    // ----------------------------------------------

    queries.push(
        [
            packageName,
            oldVersion,
            newVersion,
            apiName,
            "migration"
        ]
            .filter(Boolean)
            .join(" ")
    );


    // ----------------------------------------------
    // API + breaking changes
    // ----------------------------------------------

    queries.push(
        [
            packageName,
            apiName,
            "migration",
            "breaking changes"
        ]
            .filter(Boolean)
            .join(" ")
    );


    // ----------------------------------------------
    // Version upgrade query
    // ----------------------------------------------

    queries.push(
        [
            packageName,
            oldVersion,
            newVersion,
            "breaking changes",
            "upgrade"
        ]
            .filter(Boolean)
            .join(" ")
    );


    // ----------------------------------------------
    // Change-type query
    // ----------------------------------------------

    if (changeType) {

        queries.push(
            [
                packageName,
                apiName,
                changeType,
                "API change"
            ]
                .filter(Boolean)
                .join(" ")
        );
    }


    // ----------------------------------------------
    // Repository usage query
    // ----------------------------------------------

    for (
        const usage
        of usageContext.slice(0, 3)
    ) {

        const usageQuery =
            [
                packageName,
                apiName,
                changeType,
                "migration",
                usage.type,
                usage.receiver,
                usage.local
            ]
                .filter(Boolean)
                .join(" ");


        if (usageQuery) {

            queries.push(
                usageQuery
            );
        }
    }


    return [
        ...new Set(
            queries.filter(Boolean)
        )
    ];
}


// --------------------------------------------------
// Backwards-compatible helper
// --------------------------------------------------

function buildQuery({
    packageName,
    oldVersion,
    newVersion,
    api,
    changeType
}) {

    return buildQueries({

        packageName,

        oldVersion,

        newVersion,

        api,

        changeType

    })[0];
}


// --------------------------------------------------
// Changed APIs
// --------------------------------------------------

function getChangedApis(apiDiff) {

    const changes = [];


    for (
        const api
        of apiDiff?.added || []
    ) {

        changes.push({

            api,

            changeType:
                "added"
        });
    }


    for (
        const api
        of apiDiff?.removed || []
    ) {

        changes.push({

            api,

            changeType:
                "removed"
        });
    }


    for (
        const api
        of apiDiff?.modified || []
    ) {

        changes.push({

            api,

            changeType:
                "modified"
        });
    }


    return changes;
}


// --------------------------------------------------
// Source weight
// --------------------------------------------------

function getSourceWeight(source) {

    if (!source) {
        return 0;
    }


    const normalized =
        source.toLowerCase();


    if (
        normalized.includes("migration")
    ) {
        return 0.15;
    }


    if (
        normalized.includes("changelog") ||
        normalized.includes("history")
    ) {
        return 0.12;
    }


    if (
        normalized.includes("readme")
    ) {
        return 0.03;
    }


    return 0;
}


// --------------------------------------------------
// API relevance
// --------------------------------------------------

function getApiRelevance(
    content,
    apiName
) {

    if (
        !content ||
        !apiName
    ) {
        return 0;
    }


    const text =
        content.toLowerCase();


    const api =
        apiName.toLowerCase();


    if (
        text.includes(api)
    ) {
        return 0.15;
    }


    const parts =
        api.split(".");


    for (
        const part
        of parts
    ) {

        if (
            part &&
            text.includes(part)
        ) {

            return 0.08;
        }
    }


    return 0;
}


// --------------------------------------------------
// Version relevance
// --------------------------------------------------

function getVersionRelevance(
    content,
    oldVersion,
    newVersion
) {

    if (!content) {
        return 0;
    }


    const text =
        content.toLowerCase();


    let score = 0;


    if (
        oldVersion &&
        text.includes(
            oldVersion.toLowerCase()
        )
    ) {

        score += 0.08;
    }


    if (
        newVersion &&
        text.includes(
            newVersion.toLowerCase()
        )
    ) {

        score += 0.10;
    }


    return score;
}


// --------------------------------------------------
// Calculate evidence score
// --------------------------------------------------

function calculateEvidenceScore({
    result,
    apiName,
    oldVersion,
    newVersion
}) {

    const similarity =
        result.score || 0;


    const sourceWeight =
        getSourceWeight(
            result.source
        );


    const apiWeight =
        getApiRelevance(
            result.content,
            apiName
        );


    const versionWeight =
        getVersionRelevance(
            result.content,
            oldVersion,
            newVersion
        );


    return (
        similarity +
        sourceWeight +
        apiWeight +
        versionWeight
    );
}


// --------------------------------------------------
// Filter weak results
// --------------------------------------------------

function filterRelevantResults(
    results,
    minScore = MIN_RELEVANCE_SCORE
) {

    return results.filter(
        result =>
            typeof result.score === "number" &&
            result.score >= minScore
    );
}


// --------------------------------------------------
// Deduplicate
// --------------------------------------------------

function deduplicateResults(results) {

    const map =
        new Map();


    for (
        const result
        of results
    ) {

        const key =
            result.id ||
            [
                result.source || "",
                result.content || ""
            ].join("|");


        const existing =
            map.get(key);


        if (
            !existing ||
            result.evidenceScore >
            existing.evidenceScore
        ) {

            map.set(
                key,
                result
            );
        }
    }


    return [
        ...map.values()
    ];
}


// --------------------------------------------------
// Rank
// --------------------------------------------------

function rankResults({
    results,
    apiName,
    oldVersion,
    newVersion
}) {

    return results
        .map(
            result => ({

                ...result,

                evidenceScore:
                    calculateEvidenceScore({

                        result,

                        apiName,

                        oldVersion,

                        newVersion
                    })
            })
        )
        .sort(
            (a, b) =>
                b.evidenceScore -
                a.evidenceScore
        );
}


// --------------------------------------------------
// Retrieve one API
// --------------------------------------------------

async function retrieveForApi({
    packageName,
    oldVersion,
    newVersion,
    change,
    usageContext,
    knowledge,
    limitPerApi
}) {

    const apiName =
        getApiName(
            change.api
        );


    const queries =
        buildQueries({

            packageName,

            oldVersion,

            newVersion,

            api:
                change.api,

            changeType:
                change.changeType,

            usageContext
        });


    const allResults = [];


    for (
        const query
        of queries
    ) {

        const results =
            await searchPackageKnowledge(
                knowledge,
                query,
                limitPerApi
            );


        allResults.push(
            ...results
        );
    }


    const relevantResults =
        filterRelevantResults(
            allResults
        );


    const rankedResults =
        rankResults({

            results:
                relevantResults,

            apiName,

            oldVersion,

            newVersion
        });


    const uniqueResults =
        deduplicateResults(
            rankedResults
        );


    const finalResults =
        uniqueResults
            .sort(
                (a, b) =>
                    b.evidenceScore -
                    a.evidenceScore
            )
            .slice(
                0,
                limitPerApi
            );


    return {

        api:
            apiName,

        changeType:
            change.changeType,

        usageContext,

        queries,

        results:
            finalResults.map(
                result => ({

                    id:
                        result.id,

                    source:
                        result.source,

                    content:
                        result.content,

                    score:
                        result.score,

                    evidenceScore:
                        result.evidenceScore,

                    package:
                        result.package,

                    version:
                        result.version,

                    type:
                        result.type
                })
            )
    };
}


// --------------------------------------------------
// Main retrieval
// --------------------------------------------------

async function retrieveUpgradeEvidence({
    packageName,
    oldVersion,
    newVersion,
    apiDiff,
    impacts = [],
    knowledge,
    limitPerApi = 3
}) {

    if (!knowledge) {
        return [];
    }


    const changedApis =
        getChangedApis(
            apiDiff
        );


    const evidence = [];


    for (
        const change
        of changedApis
    ) {

        const apiName =
            getApiName(
                change.api
            );


        const usageContext =
            getUsageContext(
                impacts,
                apiName
            );


        const apiEvidence =
            await retrieveForApi({

                packageName,

                oldVersion,

                newVersion,

                change,

                usageContext,

                knowledge,

                limitPerApi
            });


        evidence.push(
            apiEvidence
        );
    }


    return evidence;
}

function evaluateEvidence(evidence) {
    const evaluation = [];

    for (const item of evidence || []) {
        const results = item.results || [];

        evaluation.push({
            api: item.api,
            changeType: item.changeType,
            usageCount: item.usageContext?.length || 0,
            retrievedCount: results.length,
            topScore: results[0]?.score || 0,
            topEvidenceScore:
                results[0]?.evidenceScore || 0,
            sources: [
                ...new Set(
                    results.map(
                        result => result.source
                    )
                )
            ]
        });
    }

    return evaluation;
}

export {
    getApiName,
    getUsageContext,
    buildQuery,
    buildQueries,
    getChangedApis,
    getSourceWeight,
    getApiRelevance,
    getVersionRelevance,
    calculateEvidenceScore,
    filterRelevantResults,
    deduplicateResults,
    rankResults,
    retrieveUpgradeEvidence,
    evaluateEvidence
};