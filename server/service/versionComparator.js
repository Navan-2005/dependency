// service/versionComparator.js

function normalizeVersion(version) {

    if (!version || typeof version !== "string") {
        return null;
    }

    return version
        .trim()
        .replace(/^[\^~=>\s]+/, "");
}


function parseVersion(version) {

    const normalized =
        normalizeVersion(version);

    if (!normalized) {
        return null;
    }

    const match =
        normalized.match(
            /^(\d+)\.(\d+)\.(\d+)/
        );

    if (!match) {
        return null;
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3])
    };
}


function compareVersions(
    versionA,
    versionB
) {

    const a =
        parseVersion(versionA);

    const b =
        parseVersion(versionB);

    if (!a || !b) {
        return null;
    }


    if (a.major !== b.major) {
        return a.major < b.major ? -1 : 1;
    }


    if (a.minor !== b.minor) {
        return a.minor < b.minor ? -1 : 1;
    }


    if (a.patch !== b.patch) {
        return a.patch < b.patch ? -1 : 1;
    }


    return 0;
}


function getVersionChangeType(
    oldVersion,
    newVersion
) {

    const oldParsed =
        parseVersion(oldVersion);

    const newParsed =
        parseVersion(newVersion);

    if (!oldParsed || !newParsed) {
        return null;
    }


    if (
        oldParsed.major !==
        newParsed.major
    ) {
        return "major";
    }


    if (
        oldParsed.minor !==
        newParsed.minor
    ) {
        return "minor";
    }


    if (
        oldParsed.patch !==
        newParsed.patch
    ) {
        return "patch";
    }


    return "none";
}


/**
 * Compare an installed package version
 * against a requested target version.
 */
function comparePackageVersion(
    packageName,
    project,
    installedVersion,
    targetVersion
) {

    const oldVersion =
        normalizeVersion(
            installedVersion
        );

    const newVersion =
        normalizeVersion(
            targetVersion
        );


    if (!oldVersion) {
        throw new Error(
            `Installed version not found for ${packageName}`
        );
    }


    if (!newVersion) {
        throw new Error(
            `Invalid target version: ${targetVersion}`
        );
    }


    const comparison =
        compareVersions(
            oldVersion,
            newVersion
        );


    if (comparison === null) {
        throw new Error(
            `Unable to compare versions: ${oldVersion} and ${newVersion}`
        );
    }


    let changeType;

    if (comparison === 0) {
        changeType = "none";
    }
    else if (comparison > 0) {
        changeType = "downgrade";
    }
    else {
        changeType =
            getVersionChangeType(
                oldVersion,
                newVersion
            );
    }


    return {

        package:
            packageName,

        project,

        currentVersion:
            oldVersion,

        targetVersion:
            newVersion,

        changeType
    };
}


export {
    normalizeVersion,
    parseVersion,
    compareVersions,
    getVersionChangeType,
    comparePackageVersion
};