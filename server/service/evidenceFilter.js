
function buildFilteredEvidence(
    evidence,
    repositoryAnalysis
) {

    if (!evidence) {
        return {
            package: null,
            project: null,
            from: null,
            to: null,
            apiChanges: {},
            impacts: [],
            compatibility: [],
            documentationEvidence: [],
            releaseNotes: [],
            packageMetadata: {}
        };
    }


    /*
     * Keep only API changes that can affect
     * existing repository code.
     */

    const impacts =
        evidence.impacts || [];


    const relevantApis =
        new Set(
            impacts.map(
                impact =>
                    normalizeApiName(
                        impact.api
                    )
            )
        );


    const relevantApiChanges = {

        removed:
            (evidence.apiChanges?.removed || [])
                .filter(api =>
                    relevantApis.has(
                        normalizeApiName(
                            getApiName(api)
                        )
                    )
                ),

        modified:
            (evidence.apiChanges?.modified || [])
                .filter(api =>
                    relevantApis.has(
                        normalizeApiName(
                            getApiName(api)
                        )
                    )
                )
    };


    /*
     * Keep only compatibility results
     * associated with affected APIs.
     */

    const compatibility =
        (evidence.compatibility || [])
            .filter(result => {

                if (!result?.api) {
                    return false;
                }

                return relevantApis.has(
                    normalizeApiName(
                        result.api
                    )
                );
            });


    /*
     * Keep RAG documentation that is
     * actually associated with changed APIs.
     *
     * If there are no matched impacts yet,
     * keep the documentation evidence rather
     * than silently throwing it away.
     */

    const documentationEvidence =
        evidence.documentationEvidence || [];


    const filteredDocumentation =
        documentationEvidence.filter(
            item => {

                if (!item?.api) {
                    return true;
                }

                if (
                    relevantApis.size === 0
                ) {
                    return true;
                }

                return relevantApis.has(
                    normalizeApiName(
                        item.api
                    )
                );
            }
        );


    /*
     * Keep repository information that is
     * useful to the LLM.
     */

    const repositoryFiles =
        extractRepositoryFiles(
            repositoryAnalysis,
            impacts
        );


    return {

        package:
            evidence.package,

        project:
            evidence.project,

        from:
            evidence.from,

        to:
            evidence.to,


        apiChanges:
            relevantApiChanges,


        impacts,


        compatibility,


        documentationEvidence:
            filteredDocumentation,


        releaseNotes:
            evidence.releaseNotes || [],


        packageMetadata:
            evidence.packageMetadata || {},


        repositoryFiles
    };
}


function getApiName(api) {

    if (!api) {
        return "";
    }

    if (
        api.parent &&
        api.name
    ) {
        return `${api.parent}.${api.name}`;
    }

    if (
        api.className &&
        api.name
    ) {
        return `${api.className}.${api.name}`;
    }

    return (
        api.name ||
        ""
    );
}


function normalizeApiName(name) {

    if (!name) {
        return "";
    }

    return name
        .toString()
        .trim()
        .toLowerCase();
}


function extractRepositoryFiles(
    repositoryAnalysis,
    impacts
) {

    const files =
        new Set();


    for (
        const impact
        of impacts || []
    ) {

        if (impact?.file) {
            files.add(
                impact.file
            );
        }

        /*
         * Some impact objects may contain
         * the complete usage object.
         */

        if (
            impact?.usage?.file
        ) {
            files.add(
                impact.usage.file
            );
        }
    }


    /*
     * If impact matching did not produce
     * files, don't dump the entire repository
     * into the LLM context.
     */

    if (files.size === 0) {
        return [];
    }


    const results = [];


    for (
        const result
        of repositoryAnalysis?.files || []
    ) {

        if (
            !files.has(
                result.file
            )
        ) {
            continue;
        }


        results.push({

            file:
                result.file,

            apiUsages:
                result.apiUsages || [],

            callSites:
                result.callSites || [],

            resolvedSymbols:
                result.resolvedSymbols || []
        });
    }


    return results;
}


export {
    buildFilteredEvidence
};

