function getApiIdentity(api) {

    const parent =
        api.parent ||
        api.className ||
        api.interfaceName ||
        null;

    const name =
        api.name ||
        "unknown";

    const kind =
        api.kind ||
        api.type ||
        "unknown";

    if (parent) {
        return `${parent}.${name}`;
    }

    return `${kind}:${name}`;
}


// --------------------------------------------------
// Normalize parameter
// --------------------------------------------------

function normalizeParameter(parameter) {

    if (!parameter) {
        return {
            name: null,
            type: null,
            optional: false
        };
    }

    return {
        name:
            parameter.name ||
            null,

        type:
            parameter.type ||
            null,

        optional:
            Boolean(
                parameter.optional
            )
    };
}


// --------------------------------------------------
// Normalize parameters
// --------------------------------------------------

function normalizeParameters(parameters) {

    if (!Array.isArray(parameters)) {
        return [];
    }

    return parameters.map(
        normalizeParameter
    );
}


// --------------------------------------------------
// Compare parameters
// --------------------------------------------------

function compareParameters(
    oldParameters,
    newParameters
) {

    const oldParams =
        normalizeParameters(
            oldParameters
        );

    const newParams =
        normalizeParameters(
            newParameters
        );


    const added = [];

    const removed = [];

    const modified = [];


    const maxLength =
        Math.max(
            oldParams.length,
            newParams.length
        );


    for (
        let i = 0;
        i < maxLength;
        i++
    ) {

        const oldParam =
            oldParams[i];

        const newParam =
            newParams[i];


        // ------------------------------------------
        // Parameter added
        // ------------------------------------------

        if (
            !oldParam &&
            newParam
        ) {

            added.push(
                newParam
            );

            continue;
        }


        // ------------------------------------------
        // Parameter removed
        // ------------------------------------------

        if (
            oldParam &&
            !newParam
        ) {

            removed.push(
                oldParam
            );

            continue;
        }


        // ------------------------------------------
        // Parameter modified
        // ------------------------------------------

        if (
            oldParam &&
            newParam
        ) {

            const changed =
                oldParam.name !== newParam.name ||
                oldParam.type !== newParam.type ||
                oldParam.optional !== newParam.optional;


            if (changed) {

                modified.push({
                    position: i,

                    old: oldParam,

                    new: newParam
                });
            }
        }
    }


    return {

        changed:
            added.length > 0 ||
            removed.length > 0 ||
            modified.length > 0,

        added,

        removed,

        modified
    };
}


// --------------------------------------------------
// Compare method / function signatures
// --------------------------------------------------

function compareSignature(
    oldApi,
    newApi
) {

    const parameterChanges =
        compareParameters(
            oldApi.parameters,
            newApi.parameters
        );


    const oldReturnType =
        oldApi.returnType ||
        oldApi.returns ||
        null;


    const newReturnType =
        newApi.returnType ||
        newApi.returns ||
        null;


    const returnTypeChanged =
        oldReturnType !==
        newReturnType;


    return {

        changed:
            parameterChanges.changed ||
            returnTypeChanged,

        parameters:
            parameterChanges,

        returnType: {

            changed:
                returnTypeChanged,

            old:
                oldReturnType,

            new:
                newReturnType
        }
    };
}


// --------------------------------------------------
// Get members
//
// Supports both:
//
// api.methods
// api.members
// --------------------------------------------------

function getMembers(api) {

    if (
        Array.isArray(
            api.methods
        )
    ) {

        return api.methods;
    }


    if (
        Array.isArray(
            api.members
        )
    ) {

        return api.members;
    }


    return [];
}


// --------------------------------------------------
// Create API map
// --------------------------------------------------

function createApiMap(
    snapshot
) {

    const map =
        new Map();


    if (
        !snapshot ||
        !Array.isArray(
            snapshot.exports
        )
    ) {

        return map;
    }


    for (
        const api
        of snapshot.exports
    ) {

        const key =
            getApiIdentity(
                api
            );


        // If the same API is exported
        // from multiple files, don't treat
        // every re-export as a different API.
        if (!map.has(key)) {

            map.set(
                key,
                api
            );
        }
    }


    return map;
}


// --------------------------------------------------
// Compare members
// --------------------------------------------------

function compareMembers(
    oldApi,
    newApi
) {

    const oldMembers =
        getMembers(
            oldApi
        );


    const newMembers =
        getMembers(
            newApi
        );


    const oldMap =
        new Map();


    const newMap =
        new Map();


    for (
        const member
        of oldMembers
    ) {

        const name =
            member.name;

        if (name) {

            oldMap.set(
                name,
                member
            );
        }
    }


    for (
        const member
        of newMembers
    ) {

        const name =
            member.name;

        if (name) {

            newMap.set(
                name,
                member
            );
        }
    }


    const added = [];

    const removed = [];

    const modified = [];

    const unchanged = [];


    // --------------------------------------------------
    // Added / modified / unchanged
    // --------------------------------------------------

    for (
        const [
            name,
            newMember
        ]
        of newMap
    ) {

        const oldMember =
            oldMap.get(
                name
            );


        if (!oldMember) {

            added.push(
                newMember
            );

            continue;
        }


        const signature =
            compareSignature(
                oldMember,
                newMember
            );


        if (
            signature.changed
        ) {

            modified.push({

                name,

                old:
                    oldMember,

                new:
                    newMember,

                signature
            });

        }
        else {

            unchanged.push(
                newMember
            );
        }
    }


    // --------------------------------------------------
    // Removed
    // --------------------------------------------------

    for (
        const [
            name,
            oldMember
        ]
        of oldMap
    ) {

        if (
            !newMap.has(
                name
            )
        ) {

            removed.push(
                oldMember
            );
        }
    }


    return {

        added,

        removed,

        modified,

        unchanged
    };
}


// --------------------------------------------------
// Find removed APIs
// --------------------------------------------------

function findRemovedApis(
    oldSnapshot,
    newSnapshot
) {

    const oldMap =
        createApiMap(
            oldSnapshot
        );


    const newMap =
        createApiMap(
            newSnapshot
        );


    const removed = [];


    for (
        const [
            key,
            oldApi
        ]
        of oldMap
    ) {

        if (
            !newMap.has(
                key
            )
        ) {

            removed.push({

                api:
                    key,

                ...oldApi,

                oldFile:
                    oldApi.file,

                oldLine:
                    oldApi.line
            });
        }
    }


    return removed;
}


// --------------------------------------------------
// Find added APIs
// --------------------------------------------------

function findAddedApis(
    oldSnapshot,
    newSnapshot
) {

    const oldMap =
        createApiMap(
            oldSnapshot
        );


    const newMap =
        createApiMap(
            newSnapshot
        );


    const added = [];


    for (
        const [
            key,
            newApi
        ]
        of newMap
    ) {

        if (
            !oldMap.has(
                key
            )
        ) {

            added.push({

                api:
                    key,

                ...newApi,

                newFile:
                    newApi.file,

                newLine:
                    newApi.line
            });
        }
    }


    return added;
}


// --------------------------------------------------
// Find modified APIs
// --------------------------------------------------

function findModifiedApis(
    oldSnapshot,
    newSnapshot
) {

    const oldMap =
        createApiMap(
            oldSnapshot
        );


    const newMap =
        createApiMap(
            newSnapshot
        );


    const modified = [];


    for (
        const [
            key,
            oldApi
        ]
        of oldMap
    ) {

        const newApi =
            newMap.get(
                key
            );


        if (!newApi) {
            continue;
        }


        const oldMembers =
            getMembers(
                oldApi
            );


        const newMembers =
            getMembers(
                newApi
            );


        // ------------------------------------------------
        // Compare class/interface members
        // ------------------------------------------------

        if (
            oldMembers.length > 0 ||
            newMembers.length > 0
        ) {

            const memberDiff =
                compareMembers(
                    oldApi,
                    newApi
                );


            if (
                memberDiff.added.length > 0 ||
                memberDiff.removed.length > 0 ||
                memberDiff.modified.length > 0
            ) {

                modified.push({

                    api:
                        key,

                    type:
                        "members-modified",

                    oldFile:
                        oldApi.file,

                    oldLine:
                        oldApi.line,

                    newFile:
                        newApi.file,

                    newLine:
                        newApi.line,

                    members:
                        memberDiff
                });
            }

            continue;
        }


        // ------------------------------------------------
        // Compare standalone function signatures
        // ------------------------------------------------

        const signature =
            compareSignature(
                oldApi,
                newApi
            );


        if (
            signature.changed
        ) {

            modified.push({

                api:
                    key,

                type:
                    "signature-modified",

                oldFile:
                    oldApi.file,

                oldLine:
                    oldApi.line,

                newFile:
                    newApi.file,

                newLine:
                    newApi.line,

                signature
            });
        }
    }


    return modified;
}


// --------------------------------------------------
// Find unchanged APIs
// --------------------------------------------------

function findUnchangedApis(
    oldSnapshot,
    newSnapshot
) {

    const oldMap =
        createApiMap(
            oldSnapshot
        );


    const newMap =
        createApiMap(
            newSnapshot
        );


    const unchanged = [];


    for (
        const [
            key,
            oldApi
        ]
        of oldMap
    ) {

        const newApi =
            newMap.get(
                key
            );


        if (!newApi) {
            continue;
        }


        const oldMembers =
            getMembers(
                oldApi
            );


        const newMembers =
            getMembers(
                newApi
            );


        if (
            oldMembers.length > 0 ||
            newMembers.length > 0
        ) {

            const memberDiff =
                compareMembers(
                    oldApi,
                    newApi
                );


            if (
                memberDiff.added.length === 0 &&
                memberDiff.removed.length === 0 &&
                memberDiff.modified.length === 0
            ) {

                unchanged.push(
                    newApi
                );
            }

        }
        else {

            const signature =
                compareSignature(
                    oldApi,
                    newApi
                );


            if (
                !signature.changed
            ) {

                unchanged.push(
                    newApi
                );
            }
        }
    }


    return unchanged;
}


// --------------------------------------------------
// Main diff function
// --------------------------------------------------

function diffApiSnapshots(
    oldSnapshot,
    newSnapshot
) {

    const added =
        findAddedApis(
            oldSnapshot,
            newSnapshot
        );


    const removed =
        findRemovedApis(
            oldSnapshot,
            newSnapshot
        );


    const modified =
        findModifiedApis(
            oldSnapshot,
            newSnapshot
        );


    const unchanged =
        findUnchangedApis(
            oldSnapshot,
            newSnapshot
        );


    let methodAdded = 0;
    let methodRemoved = 0;
    let methodModified = 0;


    for (
        const change
        of modified
    ) {

        if (
            change.type ===
            "members-modified"
        ) {

            methodAdded +=
                change.members.added.length;

            methodRemoved +=
                change.members.removed.length;

            methodModified +=
                change.members.modified.length;
        }

        else if (
            change.type ===
            "signature-modified"
        ) {

            methodModified++;
        }
    }


    return {

        package:
            newSnapshot.package,

        oldVersion:
            oldSnapshot.version,

        newVersion:
            newSnapshot.version,

        summary: {

            added:
                added.length,

            removed:
                removed.length,

            modified:
                modified.length,

            unchanged:
                unchanged.length,

            methodAdded,

            methodRemoved,

            methodModified
        },

        added,

        removed,

        modified,

        unchanged
    };
}

function searchDocumentation(
    snapshot,
    apiNames
) {

    if (
        !snapshot ||
        !Array.isArray(
            snapshot.documentation
        )
    ) {

        return [];
    }


    const results = [];


    for (
        const document
        of snapshot.documentation
    ) {

        if (
            !document.content
        ) {
            continue;
        }


        const lines =
            document.content.split(
                /\r?\n/
            );


        for (
            const apiName
            of apiNames
        ) {

            if (!apiName) {
                continue;
            }


            const matchingLines = [];


            for (
                let i = 0;
                i < lines.length;
                i++
            ) {

                if (
                    lines[i]
                        .toLowerCase()
                        .includes(
                            apiName.toLowerCase()
                        )
                ) {

                    matchingLines.push({

                        line:
                            i + 1,

                        text:
                            lines[i].trim()
                    });
                }
            }


            if (
                matchingLines.length > 0
            ) {

                results.push({

                    file:
                        document.file,

                    api:
                        apiName,

                    matches:
                        matchingLines.slice(
                            0,
                            20
                        )
                });
            }
        }
    }


    return results;
}

export {
    getApiIdentity,
    normalizeParameter,
    normalizeParameters,
    compareParameters,
    compareSignature,
    createApiMap,
    compareMembers,
    findAddedApis,
    findRemovedApis,
    findModifiedApis,
    findUnchangedApis,
    diffApiSnapshots,
    searchDocumentation
};