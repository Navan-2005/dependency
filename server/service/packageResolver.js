// service/packageResolver.js

import fs from "fs";
import path from "path";


// ============================================================
// Directories that should not be scanned
// ============================================================

const IGNORED_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage"
]);


// ============================================================
// Find all package.json files
// ============================================================

function findPackageJsonFiles(repoRoot) {

    const results = [];

    function walk(directory) {

        let entries;

        try {
            entries = fs.readdirSync(directory, {
                withFileTypes: true
            });
        } catch {
            return;
        }


        for (const entry of entries) {

            if (
                entry.isDirectory() &&
                IGNORED_DIRECTORIES.has(entry.name)
            ) {
                continue;
            }


            const fullPath =
                path.join(directory, entry.name);


            if (entry.isDirectory()) {

                walk(fullPath);

            } else if (
                entry.isFile() &&
                entry.name === "package.json"
            ) {

                results.push(fullPath);
            }
        }
    }


    walk(repoRoot);

    return results;
}


// ============================================================
// Find lockfile next to package.json
// ============================================================

function findLockfile(packageJsonPath) {

    const directory =
        path.dirname(packageJsonPath);


    const packageLock =
        path.join(
            directory,
            "package-lock.json"
        );


    if (fs.existsSync(packageLock)) {
        return {
            path: packageLock,
            type: "npm"
        };
    }


    const yarnLock =
        path.join(
            directory,
            "yarn.lock"
        );


    if (fs.existsSync(yarnLock)) {
        return {
            path: yarnLock,
            type: "yarn"
        };
    }


    const pnpmLock =
        path.join(
            directory,
            "pnpm-lock.yaml"
        );


    if (fs.existsSync(pnpmLock)) {
        return {
            path: pnpmLock,
            type: "pnpm"
        };
    }


    return null;
}


// ============================================================
// Read npm package-lock.json
// ============================================================

function readNpmLockfile(lockfilePath) {

    try {

        const raw =
            fs.readFileSync(
                lockfilePath,
                "utf8"
            );


        const lock =
            JSON.parse(raw);


        const installedVersions = {};


        // npm lockfile v2 / v3
        if (lock.packages) {

            for (
                const [packagePath, packageInfo]
                of Object.entries(lock.packages)
            ) {

                if (
                    !packagePath.startsWith(
                        "node_modules/"
                    )
                ) {
                    continue;
                }


                if (!packageInfo?.version) {
                    continue;
                }


                const packageName =
                    getPackageNameFromNodeModulesPath(
                        packagePath
                    );


                if (!packageName) {
                    continue;
                }


                // Keep the first version encountered
                // for now. Nested dependency versions
                // will be handled later.

                if (!installedVersions[packageName]) {

                    installedVersions[packageName] =
                        packageInfo.version;
                }
            }
        }


        return installedVersions;

    } catch (error) {

        console.warn(
            `Could not read ${lockfilePath}: ${error.message}`
        );

        return {};
    }
}


// ============================================================
// Convert:
// node_modules/express
//
// to:
// express
//
// And:
// node_modules/@prisma/client
//
// to:
// @prisma/client
// ============================================================

function getPackageNameFromNodeModulesPath(
    packagePath
) {

    const parts =
        packagePath.split("/");


    if (
        parts.length < 2 ||
        parts[0] !== "node_modules"
    ) {
        return null;
    }


    if (
        parts[1].startsWith("@")
    ) {

        if (parts.length < 3) {
            return null;
        }


        return `${parts[1]}/${parts[2]}`;
    }


    return parts[1];
}


// ============================================================
// Read package.json
// ============================================================

function readPackageJson(
    packageJsonPath,
    repoRoot
) {

    try {

        const raw =
            fs.readFileSync(
                packageJsonPath,
                "utf8"
            );


        const packageJson =
            JSON.parse(raw);


        const relativePackageJson =
            path.relative(
                repoRoot,
                packageJsonPath
            ).replace(/\\/g, "/");


        const project =
            path.dirname(
                relativePackageJson
            ) || ".";


        // ----------------------------------------------------
        // Find lockfile
        // ----------------------------------------------------

        const lockfile =
            findLockfile(
                packageJsonPath
            );


        let installedVersions = {};


        if (
            lockfile &&
            lockfile.type === "npm"
        ) {

            installedVersions =
                readNpmLockfile(
                    lockfile.path
                );
        }


        const packages = [];


        // ----------------------------------------------------
        // dependencies
        // ----------------------------------------------------

        for (
            const [name, version]
            of Object.entries(
                packageJson.dependencies || {}
            )
        ) {

            packages.push({

                name,

                declaredVersion: version,

                installedVersion:
                    installedVersions[name] || null,

                type: "dependency",

                project,

                packageJson: relativePackageJson,

                lockfile:
                    lockfile
                        ? path.relative(
                            repoRoot,
                            lockfile.path
                        ).replace(/\\/g, "/")
                        : null
            });
        }


        // ----------------------------------------------------
        // devDependencies
        // ----------------------------------------------------

        for (
            const [name, version]
            of Object.entries(
                packageJson.devDependencies || {}
            )
        ) {

            packages.push({

                name,

                declaredVersion: version,

                installedVersion:
                    installedVersions[name] || null,

                type: "devDependency",

                project,

                packageJson: relativePackageJson,

                lockfile:
                    lockfile
                        ? path.relative(
                            repoRoot,
                            lockfile.path
                        ).replace(/\\/g, "/")
                        : null
            });
        }


        return {
            project,
            packageJson: relativePackageJson,
            lockfile:
                lockfile
                    ? path.relative(
                        repoRoot,
                        lockfile.path
                    ).replace(/\\/g, "/")
                    : null,
            packages
        };

    } catch (error) {

        console.warn(
            `Could not read ${packageJsonPath}: ${error.message}`
        );

        return null;
    }
}


// ============================================================
// Main function
// ============================================================

function getPackageVersions(repoRoot) {

    const packageJsonFiles =
        findPackageJsonFiles(repoRoot);


    const projects = [];


    for (
        const packageJsonPath
        of packageJsonFiles
    ) {

        const project =
            readPackageJson(
                packageJsonPath,
                repoRoot
            );


        if (project) {
            projects.push(project);
        }
    }


    return projects;
}


export {
    getPackageVersions
};