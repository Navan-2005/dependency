import {
    retrieveUpgradeEvidence
} from "./upgradeRetriever.js";


function normalizeSource(source) {
    if (!source) {
        return "";
    }

    return source
        .toLowerCase()
        .trim();
}


function isRelevantResult(
    result,
    expectedSources = [],
    expectedTerms = []
) {
    const source =
        normalizeSource(result.source);

    const sourceMatch =
        expectedSources.some(
            expected =>
                source ===
                normalizeSource(expected)
        );

    const content =
        (result.content || "")
            .toLowerCase();

    const termMatches =
        expectedTerms.filter(
            term =>
                content.includes(
                    term.toLowerCase()
                )
        ).length;

    return sourceMatch || termMatches > 0;
}


function recallAtK(
    results,
    k,
    expectedSources,
    expectedTerms
) {
    const topResults =
        results.slice(0, k);

    return topResults.some(
        result =>
            isRelevantResult(
                result,
                expectedSources,
                expectedTerms
            )
    )
        ? 1
        : 0;
}


function precisionAtK(
    results,
    k,
    expectedSources,
    expectedTerms
) {
    const topResults =
        results.slice(0, k);

    if (topResults.length === 0) {
        return 0;
    }

    const relevant =
        topResults.filter(
            result =>
                isRelevantResult(
                    result,
                    expectedSources,
                    expectedTerms
                )
        ).length;

    return relevant / topResults.length;
}


function reciprocalRank(
    results,
    expectedSources,
    expectedTerms
) {
    for (
        let i = 0;
        i < results.length;
        i++
    ) {
        if (
            isRelevantResult(
                results[i],
                expectedSources,
                expectedTerms
            )
        ) {
            return 1 / (i + 1);
        }
    }

    return 0;
}


async function evaluateRagTest(
    test,
    knowledge
) {
    const evidence =
        await retrieveUpgradeEvidence({
            packageName:
                test.package,

            oldVersion:
                test.from,

            newVersion:
                test.to,

            apiDiff:
                test.apiDiff,

            impacts:
                test.impacts || [],

            knowledge,

            limitPerApi:
                test.limit || 3
        });

    const apiEvidence =
        evidence.find(
            item =>
                item.api === test.api
        );

    const results =
        apiEvidence?.results || [];

    return {
        api: test.api,

        retrievedCount:
            results.length,

        recallAt3:
            recallAtK(
                results,
                3,
                test.expectedSources,
                test.expectedTerms
            ),

        precisionAt3:
            precisionAtK(
                results,
                3,
                test.expectedSources,
                test.expectedTerms
            ),

        mrr:
            reciprocalRank(
                results,
                test.expectedSources,
                test.expectedTerms
            ),

        results
    };
}


async function evaluateRag(
    tests,
    knowledge
) {
    const results = [];

    for (
        const test
        of tests
    ) {
        const result =
            await evaluateRagTest(
                test,
                knowledge
            );

        results.push(result);
    }

    return results;
}


function summarizeEvaluation(
    results
) {
    if (
        !results ||
        results.length === 0
    ) {
        return {
            tests: 0,
            recallAt3: 0,
            precisionAt3: 0,
            mrr: 0
        };
    }

    const total =
        results.length;

    return {
        tests: total,

        recallAt3:
            results.reduce(
                (sum, result) =>
                    sum + result.recallAt3,
                0
            ) / total,

        precisionAt3:
            results.reduce(
                (sum, result) =>
                    sum + result.precisionAt3,
                0
            ) / total,

        mrr:
            results.reduce(
                (sum, result) =>
                    sum + result.mrr,
                0
            ) / total
    };
}


export {
    normalizeSource,
    isRelevantResult,
    recallAtK,
    precisionAtK,
    reciprocalRank,
    evaluateRagTest,
    evaluateRag,
    summarizeEvaluation
};