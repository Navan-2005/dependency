
import { analyzeJavaScript } from "../controller/repo.js";

import { getPackageVersions } from "./packageResolver.js";
import { comparePackageVersion } from "./versionComparator.js";
import { analyzePackageVersion } from "./packageApiAnalyzer.js";
import { diffApiSnapshots } from "./apiDiff.js";
import { buildUpgradeEvidence } from "./upgradeEvidence.js";
import { generateImpactReport } from "./apiImpactMatcher.js";
import { analyzeUpgradeWithLLM } from "./llmAnalyzer.js";
import { buildFilteredEvidence } from "./evidenceFilter.js";
import { buildCompatibilityResults } from "./apiCompatibility.js";

import {
    buildPackageKnowledge
} from "./rag/packageKnowledge.js";

import {
    retrieveUpgradeEvidence
} from "./rag/upgradeRetriever.js";


async function analyzeUpgrade(
    repoPath,
    projectName,
    packageName,
    targetVersion
) {

    /* 1. Analyze repository */

    const repositoryAnalysis =
        await analyzeJavaScript(repoPath);


    /* 2. Find project */

    const projects =
        getPackageVersions(repoPath);

    const project =
        projects.find(
            (item) =>
                item.project === projectName
        );

    if (!project) {
        throw new Error(
            `Project not found: ${projectName}`
        );
    }


    /* 3. Find package */

    const packageInfo =
        project.packages.find(
            (item) =>
                item.name === packageName
        );

    if (!packageInfo) {
        throw new Error(
            `${packageName} is not declared in ${projectName}`
        );
    }


    /* 4. Get installed version */

    const installedVersion =
        packageInfo.installedVersion;

    if (!installedVersion) {
        throw new Error(
            `Installed version not found for ${packageName}`
        );
    }


    /* 5. Compare versions */

    const versionComparison =
        comparePackageVersion(
            packageName,
            projectName,
            installedVersion,
            targetVersion
        );


    /* 6. No upgrade required */

    if (
        versionComparison.changeType ===
        "none"
    ) {

        return {
            package: packageName,

            project: projectName,

            currentVersion:
                versionComparison.currentVersion,

            targetVersion:
                versionComparison.targetVersion,

            changeType:
                "none",

            message:
                "Target version is the same as the installed version.",

            summary: {
                addedApis: 0,
                removedApis: 0,
                modifiedApis: 0,
                affectedFiles: 0,
                breakingChanges: 0
            },

            impacts: [],

            releaseNotes: [],

            documentation: [],

            documentationEvidence: [],

            compatibilityResults: [],

            llmAnalysis: null
        };
    }


    /* 7. Analyze current package */

    console.log(
        `Analyzing ${packageName}@${installedVersion}...`
    );

    const currentSnapshot =
        await analyzePackageVersion(
            packageName,
            installedVersion
        );


    /* 8. Analyze target package */

    console.log(
        `Analyzing ${packageName}@${targetVersion}...`
    );

    const targetSnapshot =
        await analyzePackageVersion(
            packageName,
            targetVersion
        );


    /* 9. Compare package APIs */

    console.log(
        "Comparing package APIs..."
    );

    const apiDiff =
        diffApiSnapshots(
            currentSnapshot,
            targetSnapshot
        );


    /* 10. Find repository impact */

    console.log(
        "Matching repository API usage..."
    );

    const impactReport =
        generateImpactReport(
            packageName,
            projectName,
            installedVersion,
            targetVersion,
            repositoryAnalysis,
            apiDiff
        );

    console.log(
        "IMPACTS:",
        JSON.stringify(
            impactReport.impacts,
            null,
            2
        )
    );


    /* 11. Analyze API compatibility */

    console.log(
        "Analyzing API compatibility..."
    );

    const compatibilityResults =
        buildCompatibilityResults({
            impacts:
                impactReport.impacts,

            oldApis:
                currentSnapshot.exports,

            newApis:
                targetSnapshot.exports
        });

    console.log(
        "COMPATIBILITY:",
        JSON.stringify(
            compatibilityResults,
            null,
            2
        )
    );


    /* 12. Build RAG knowledge base */

    console.log(
        "Building package knowledge base..."
    );

    const packageKnowledge =
        await buildPackageKnowledge(
            targetSnapshot
        );

    console.log(
        `Knowledge chunks: ${packageKnowledge.chunks.length}`
    );


    /* 13. Retrieve relevant documentation */

    console.log(
        "Retrieving upgrade documentation..."
    );

const documentationEvidence =
    await retrieveUpgradeEvidence({
        packageName,
        oldVersion: installedVersion,
        newVersion: targetVersion,
        apiDiff,
        impacts: impactReport.impacts,
        knowledge: packageKnowledge,
        limitPerApi: 3
    });

    console.log(
        "DOCUMENTATION EVIDENCE:",
        JSON.stringify(
            documentationEvidence,
            null,
            2
        )
    );


    /* 14. Build upgrade evidence */

const evidence =
    buildUpgradeEvidence({
        packageName,

        projectName,

        currentVersion:
            installedVersion,

        targetVersion,

        apiDiff,

        impactReport,

        currentSnapshot,

        targetSnapshot,

        compatibilityResults,

        documentationEvidence
    });


    /* 15. Filter evidence */

    console.log(
        "Filtering upgrade evidence..."
    );

    const filteredEvidence =
        buildFilteredEvidence(
            evidence,
            repositoryAnalysis
        );


    /* 16. LLM reasoning */

    console.log(
        "Running Gemini analysis..."
    );

    const llmAnalysis =
        await analyzeUpgradeWithLLM(
            filteredEvidence
        );


    /* 17. Build final result */

    return {
        package:
            packageName,

        project:
            projectName,

        currentVersion:
            installedVersion,

        targetVersion:
            targetVersion,

        changeType:
            versionComparison.changeType,

        packageJson:
            packageInfo.packageJson,

        lockfile:
            packageInfo.lockfile,

        apiDiff,

        impacts:
            impactReport,

        compatibilityResults,

        evidence,

        filteredEvidence,

        documentationEvidence,

        releaseNotes:
            targetSnapshot.documentation || [],

        documentation:
            targetSnapshot.metadata || {},

        llmAnalysis
    };
}


export {
    analyzeUpgrade
};