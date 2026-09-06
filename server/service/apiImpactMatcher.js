function normalizeApiName(name) {

    if (
        !name ||
        typeof name !== "string"
    ) {
        return null;
    }

    return name
        .trim()
        .replace(/^.*\./, "");
}


// --------------------------------------------------
// Collect repository API usages
// --------------------------------------------------

function getRepositoryUsages(
    repositoryAnalysis
) {

    const usages = [];


    if (
        !repositoryAnalysis ||
        !Array.isArray(
            repositoryAnalysis.files
        )
    ) {

        return usages;
    }


    for (
        const file
        of repositoryAnalysis.files
    ) {

        if (
            !Array.isArray(
                file.apiUsages
            )
        ) {

            continue;
        }


        for (
            const usage
            of file.apiUsages
        ) {

            usages.push({

                ...usage,

                file:
                    file.file
            });
        }
    }


    return usages;
}


// --------------------------------------------------
// Get changed API name
// --------------------------------------------------

function getChangedApiName(
    change
) {

    if (
        change.name
    ) {

        return normalizeApiName(
            change.name
        );
    }


    if (
        change.api
    ) {

        return normalizeApiName(
            change.api
        );
    }


    return null;
}


// --------------------------------------------------
// Determine change type
// --------------------------------------------------

function getChangeType(
    change,
    category
) {

    if (
        category ===
        "removed"
    ) {

        return "api-removed";
    }


    if (
        change.type ===
        "signature-modified"
    ) {

        return "signature-modified";
    }


    if (
        change.type ===
        "members-modified"
    ) {

        return "members-modified";
    }


    return "api-modified";
}


// --------------------------------------------------
// Classify signature change
// --------------------------------------------------

function classifySignatureChange(
    signature
) {

    if (!signature) {

        return {
            breaking: true,
            severity: "high",
            reason:
                "The API signature changed.",
            recommendation:
                "Review all usages of this API."
        };
    }


    const parameters =
        signature.parameters;


    if (
        parameters
    ) {

        // ------------------------------------------
        // Removed parameters
        // ------------------------------------------

        if (
            parameters.removed &&
            parameters.removed.length > 0
        ) {

            return {

                breaking: true,

                severity: "high",

                reason:
                    "One or more parameters were removed from the API.",

                recommendation:
                    "Update calls that still pass the removed parameters."
            };
        }


        // ------------------------------------------
        // Modified parameters
        // ------------------------------------------

        if (
            parameters.modified &&
            parameters.modified.length > 0
        ) {

            return {

                breaking: true,

                severity: "high",

                reason:
                    "One or more parameter types or optionality changed.",

                recommendation:
                    "Review the arguments passed to this API."
            };
        }


        // ------------------------------------------
        // Added parameters
        // ------------------------------------------

        if (
            parameters.added &&
            parameters.added.length > 0
        ) {

            const required =
                parameters.added.some(
                    parameter =>
                        !parameter.optional
                );


            if (required) {

                return {

                    breaking: true,

                    severity: "high",

                    reason:
                        "A new required parameter was added.",

                    recommendation:
                        "Update existing calls to provide the new parameter."
                };
            }


            return {

                breaking: false,

                severity: "low",

                reason:
                    "An optional parameter was added.",

                recommendation:
                    "No change is normally required."
            };
        }
    }


    // ------------------------------------------
    // Return type
    // ------------------------------------------

    if (
        signature.returnType &&
        signature.returnType.changed
    ) {

        return {

            breaking: true,

            severity: "medium",

            reason:
                "The API return type changed.",

            recommendation:
                "Review code that consumes the return value."
        };
    }


    return {

        breaking: true,

        severity: "medium",

        reason:
            "The API signature changed.",

        recommendation:
            "Review existing calls to this API."
    };
}


// --------------------------------------------------
// Classify general API change
// --------------------------------------------------

function classifyChange(
    change,
    category
) {

    // ------------------------------------------
    // Removed API
    // ------------------------------------------

    if (
        category ===
        "removed"
    ) {

        return {

            breaking: true,

            severity: "high",

            reason:
                "The API was removed from the target package version.",

            recommendation:
                "Replace this API with the supported alternative."
        };
    }


    // ------------------------------------------
    // Signature modification
    // ------------------------------------------

    if (
        change.type ===
        "signature-modified"
    ) {

        return classifySignatureChange(
            change.signature
        );
    }


    // ------------------------------------------
    // Member modification
    // ------------------------------------------

    if (
        change.type ===
        "members-modified"
    ) {

        const members =
            change.members;


        if (
            members &&
            members.removed &&
            members.removed.length > 0
        ) {

            return {

                breaking: true,

                severity: "high",

                reason:
                    "One or more members used by this API were removed.",

                recommendation:
                    "Replace usages of the removed member."
            };
        }


        if (
            members &&
            members.modified &&
            members.modified.length > 0
        ) {

            return {

                breaking: true,

                severity: "high",

                reason:
                    "One or more members changed signature or type.",

                recommendation:
                    "Review the affected member usages."
            };
        }


        if (
            members &&
            members.added &&
            members.added.length > 0
        ) {

            return {

                breaking: false,

                severity: "low",

                reason:
                    "New members were added to the API.",

                recommendation:
                    "No change is required for existing usages."
            };
        }
    }


    return {

        breaking: true,

        severity: "medium",

        reason:
            "The API changed between package versions.",

        recommendation:
            "Review existing usages of this API."
    };
}


// --------------------------------------------------
// Match a change against repository usages
// --------------------------------------------------

function matchChange(
    change,
    category,
    usages,
    packageName
) {

    const changedApi =
        getChangedApiName(
            change
        );


    if (!changedApi) {
        return [];
    }


    const classification =
        classifyChange(
            change,
            category
        );


    const impacts = [];


    for (
        const usage
        of usages
    ) {

        if (
            usage.package !==
            packageName
        ) {

            continue;
        }


        const usedApi =
            normalizeApiName(
                usage.api
            );


        if (!usedApi) {
            continue;
        }


        if (
            usedApi !==
            changedApi
        ) {

            continue;
        }


        impacts.push({

            package:
                packageName,

            api:
                change.api ||
                change.name,

            changeType:
                getChangeType(
                    change,
                    category
                ),

            breaking:
                classification.breaking,

            severity:
                classification.severity,

            reason:
                classification.reason,

            recommendation:
                classification.recommendation,

            file:
                usage.file,

            line:
                usage.line,

            local:
                usage.local,

            usageType:
                usage.type,

            oldFile:
                change.oldFile,

            oldLine:
                change.oldLine,

            newFile:
                change.newFile,

            newLine:
                change.newLine
        });
    }


    return impacts;
}


// --------------------------------------------------
// Match all breaking / potentially breaking changes
// --------------------------------------------------

function matchApiImpacts(
    repositoryAnalysis,
    apiDiff,
    packageName
) {

    const usages =
        getRepositoryUsages(
            repositoryAnalysis
        );


    const impacts = [];


    // ------------------------------------------
    // Removed
    // ------------------------------------------

    for (
        const change
        of apiDiff.removed || []
    ) {

        impacts.push(
            ...matchChange(
                change,
                "removed",
                usages,
                packageName
            )
        );
    }


    // ------------------------------------------
    // Modified
    // ------------------------------------------

    for (
        const change
        of apiDiff.modified || []
    ) {

        impacts.push(
            ...matchChange(
                change,
                "modified",
                usages,
                packageName
            )
        );
    }


    return impacts;
}


// --------------------------------------------------
// Generate report
// --------------------------------------------------

function generateImpactReport(
    repositoryAnalysis,
    apiDiff,
    packageName
) {

    const impacts =
        matchApiImpacts(
            repositoryAnalysis,
            apiDiff,
            packageName
        );


    const summary = {

        total:
            impacts.length,

        breaking:
            impacts.filter(
                impact =>
                    impact.breaking
            ).length,

        high:
            impacts.filter(
                impact =>
                    impact.severity ===
                    "high"
            ).length,

        medium:
            impacts.filter(
                impact =>
                    impact.severity ===
                    "medium"
            ).length,

        low:
            impacts.filter(
                impact =>
                    impact.severity ===
                    "low"
            ).length
    };


    return {

        package:
            packageName,

        currentVersion:
            apiDiff.oldVersion,

        targetVersion:
            apiDiff.newVersion,

        summary,

        impacts
    };
}


export {

    normalizeApiName,

    getRepositoryUsages,

    getChangedApiName,

    getChangeType,

    classifySignatureChange,

    classifyChange,

    matchApiImpacts,

    generateImpactReport
};