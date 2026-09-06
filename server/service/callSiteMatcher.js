function normalizeApiName(name) {

    if (!name) {
        return "";
    }

    return name
        .trim()
        .toLowerCase();
}


function getUsageApiName(usage) {

    if (!usage) {
        return "";
    }


    /*
     * Existing usage format:
     *
     * {
     *     package: "jsonwebtoken",
     *     api: "verify",
     *     local: "jwt"
     * }
     *
     * We want:
     *
     * jwt.verify
     */

    if (
        usage.local &&
        usage.api
    ) {

        return normalizeApiName(
            `${usage.local}.${usage.api}`
        );
    }


    /*
     * Fallback for usages that already
     * contain the complete API name.
     */

    if (usage.api) {

        return normalizeApiName(
            usage.api
        );
    }


    if (usage.name) {

        return normalizeApiName(
            usage.name
        );
    }


    return "";
}


function getCallSiteApiName(
    callSite
) {

    if (!callSite) {
        return "";
    }


    return normalizeApiName(
        callSite.callee
    );
}


function findMatchingCallSite(
    usage,
    callSites
) {

    if (
        !usage ||
        !Array.isArray(callSites)
    ) {
        return null;
    }


    const usageName =
        getUsageApiName(
            usage
        );


    if (!usageName) {
        return null;
    }


    /*
     * First:
     *
     * Match API name AND line.
     *
     * This prevents accidentally
     * matching another call to the
     * same function.
     */

    const exactMatch =
        callSites.find(
            callSite => {

                const callName =
                    getCallSiteApiName(
                        callSite
                    );


                return (
                    callName ===
                        usageName &&
                    callSite.line ===
                        usage.line
                );
            }
        );


    if (exactMatch) {
        return exactMatch;
    }


    /*
     * Fallback:
     *
     * Match API name only.
     */

    const nameMatch =
        callSites.find(
            callSite =>
                getCallSiteApiName(
                    callSite
                ) ===
                usageName
        );


    return nameMatch || null;
}


function enrichApiUsages(
    results
) {

    for (
        const result of results
    ) {

        const usages =
            result.apiUsages || [];


        const callSites =
            result.callSites || [];


        for (
            const usage of usages
        ) {

            const callSite =
                findMatchingCallSite(
                    usage,
                    callSites
                );


            if (!callSite) {
                continue;
            }


            usage.callSite = {

                callee:
                    callSite.callee,

                argumentCount:
                    callSite.argumentCount,

                arguments:
                    callSite.arguments
            };
        }
    }


    return results;
}


export {
    normalizeApiName,
    getUsageApiName,
    getCallSiteApiName,
    findMatchingCallSite,
    enrichApiUsages
};