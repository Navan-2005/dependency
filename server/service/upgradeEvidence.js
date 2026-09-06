
function buildUpgradeEvidence({
    packageName,
    projectName,
    currentVersion,
    targetVersion,
    apiDiff,
    impactReport,
    currentSnapshot,
    targetSnapshot,
    compatibilityResults = [],
    documentationEvidence = []
}) {

    return {

        package:
            packageName,

        project:
            projectName,

        from:
            currentVersion,

        to:
            targetVersion,


        /*
         * API changes detected between versions
         */

        apiChanges: {

            added:
                apiDiff?.added || [],

            removed:
                apiDiff?.removed || [],

            modified:
                apiDiff?.modified || [],

            unchanged:
                apiDiff?.unchanged || []
        },


        /*
         * Repository impact
         */

        impacts:
            impactReport?.impacts || [],


        /*
         * Deterministic compatibility analysis
         */

        compatibility:
            compatibilityResults || [],


        /*
         * RAG documentation evidence
         */

        documentationEvidence:
            documentationEvidence || [],


        /*
         * Package documentation
         */

        releaseNotes:
            targetSnapshot?.documentation || [],


        /*
         * Package metadata
         */

        packageMetadata: {

            current:
                currentSnapshot?.metadata || {},

            target:
                targetSnapshot?.metadata || {}
        }
    };
}


export {
    buildUpgradeEvidence
};

