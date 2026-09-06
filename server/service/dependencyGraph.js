// service/dependencyGraph.js

/**
 * Find which project owns a source file.
 *
 * Example:
 *
 * packageProjects:
 * [
 *   { project: "client", ... },
 *   { project: "server", ... },
 *   { project: "db", ... }
 * ]
 *
 * file:
 * "server/routes/tradeRoute.js"
 *
 * result:
 * server project
 */
function findProjectForFile(file, packageProjects = []) {

    let bestMatch = null;

    for (const project of packageProjects) {

        const projectPath =
            project.project === "."
                ? ""
                : project.project;

        // Root project
        if (projectPath === "") {

            if (!bestMatch) {
                bestMatch = project;
            }

            continue;
        }

        // File belongs to this project
        if (
            file === projectPath ||
            file.startsWith(`${projectPath}/`)
        ) {

            // Pick the deepest matching project.
            //
            // This matters for nested projects such as:
            //
            // apps/
            // apps/web/
            //
            // A file inside apps/web should belong to apps/web.
            if (
                !bestMatch ||
                projectPath.length >
                    (
                        bestMatch.project === "."
                            ? 0
                            : bestMatch.project.length
                    )
            ) {

                bestMatch = project;
            }
        }
    }

    return bestMatch;
}


/**
 * Find a package declaration inside a project.
 *
 * Example:
 *
 * project = server
 * packageName = express
 *
 * returns:
 *
 * {
 *   name: "express",
 *   declaredVersion: "^5.1.0",
 *   installedVersion: "5.1.0",
 *   ...
 * }
 */
function findPackageInProject(
    packageName,
    project
) {

    if (!project) {
        return null;
    }

    return (
        project.packages || []
    ).find(
        (pkg) => pkg.name === packageName
    ) || null;
}


/**
 * Create a unique package node ID.
 *
 * Example:
 *
 * server + express
 *
 * becomes:
 *
 * server:express
 */
function getPackageNodeId(
    project,
    packageName
) {

    if (!project) {
        return packageName;
    }

    const projectName =
        project.project || ".";

    return `${projectName}:${packageName}`;
}


/**
 * Find the package project that declares a package.
 *
 * Normally the package should be declared by the project
 * containing the source file.
 *
 * Example:
 *
 * server/routes/user.js
 * imports express
 *
 * First look in:
 *
 * server/package.json
 *
 * If it isn't there, fall back to searching all projects.
 */
function resolvePackageProject(
    packageName,
    fileProject,
    packageProjects
) {

    // --------------------------------------------------
    // 1. Prefer the project owning the source file
    // --------------------------------------------------

    const localPackage =
        findPackageInProject(
            packageName,
            fileProject
        );

    if (localPackage) {
        return {
            project: fileProject,
            package: localPackage
        };
    }


    // --------------------------------------------------
    // 2. Fallback: search all projects
    // --------------------------------------------------

    for (const project of packageProjects) {

        const pkg =
            findPackageInProject(
                packageName,
                project
            );

        if (pkg) {

            return {
                project,
                package: pkg
            };
        }
    }


    // --------------------------------------------------
    // 3. Package isn't declared anywhere
    // --------------------------------------------------

    return {
        project: fileProject || null,
        package: null
    };
}


/**
 * Build dependency graph.
 *
 * Graph contains:
 *
 * FILE
 *   ↓ import
 * FILE
 *
 * FILE
 *   ↓ dependency
 * PACKAGE
 *
 * FILE
 *   ↓ api-usage
 * PACKAGE
 *
 * Package nodes are project-aware:
 *
 * server:express
 * client:react
 * db:prisma
 */
function buildDependencyGraph(
    results,
    packageProjects = []
) {

    const nodes = [];
    const edges = [];

    const fileNodeSet = new Set();
    const packageNodeSet = new Set();
    const edgeSet = new Set();


    // ==================================================
    // 1. Create file nodes
    // ==================================================

    for (const result of results) {

        if (!result.file) {
            continue;
        }

        if (fileNodeSet.has(result.file)) {
            continue;
        }

        fileNodeSet.add(result.file);

        nodes.push({
            id: result.file,
            type: "file"
        });
    }


    // ==================================================
    // 2. Create package nodes from package.json data
    // ==================================================

    for (const project of packageProjects) {

        for (const pkg of project.packages || []) {

            const packageId =
                getPackageNodeId(
                    project,
                    pkg.name
                );

            if (packageNodeSet.has(packageId)) {
                continue;
            }

            packageNodeSet.add(packageId);

            nodes.push({
                id: packageId,
                name: pkg.name,
                type: "package",

                project:
                    project.project,

                declaredVersion:
                    pkg.declaredVersion,

                installedVersion:
                    pkg.installedVersion,

                packageJson:
                    pkg.packageJson,

                lockfile:
                    pkg.lockfile
            });
        }
    }


    // ==================================================
    // 3. Process each source file
    // ==================================================

    for (const result of results) {

        const fileProject =
            findProjectForFile(
                result.file,
                packageProjects
            );


        // ==================================================
        // Local ES module imports
        // ==================================================

        for (const imp of result.imports || []) {

            if (
                imp.type !== "local" ||
                !imp.resolvedPath
            ) {
                continue;
            }


            const resolvedSymbols =
                (result.resolvedSymbols || [])
                    .filter(
                        (symbol) =>
                            symbol.sourceFile ===
                            imp.resolvedPath
                    );


            // ----------------------------------------------
            // Import with resolved symbols
            // ----------------------------------------------

            if (resolvedSymbols.length > 0) {

                for (const symbol of resolvedSymbols) {

                    const edgeKey =
                        [
                            result.file,
                            symbol.sourceFile,
                            symbol.local,
                            "import"
                        ].join("|");


                    if (edgeSet.has(edgeKey)) {
                        continue;
                    }

                    edgeSet.add(edgeKey);


                    edges.push({
                        from: result.file,

                        to:
                            symbol.sourceFile,

                        type: "import",

                        symbol:
                            symbol.local,

                        imported:
                            symbol.imported,

                        line:
                            imp.line,

                        sourceLine:
                            symbol.sourceLine
                    });
                }

            }

            // ----------------------------------------------
            // Import without resolved symbols
            // ----------------------------------------------

            else {

                const edgeKey =
                    [
                        result.file,
                        imp.resolvedPath,
                        "import"
                    ].join("|");


                if (edgeSet.has(edgeKey)) {
                    continue;
                }

                edgeSet.add(edgeKey);


                edges.push({
                    from:
                        result.file,

                    to:
                        imp.resolvedPath,

                    type:
                        "import",

                    symbol:
                        null,

                    imported:
                        null,

                    line:
                        imp.line,

                    sourceLine:
                        null
                });
            }
        }


        // ==================================================
        // 4. CommonJS require()
        // ==================================================

        for (const req of result.requires || []) {

            if (
                req.type !== "local" ||
                !req.resolvedPath
            ) {
                continue;
            }


            const edgeKey =
                [
                    result.file,
                    req.resolvedPath,
                    "require"
                ].join("|");


            if (edgeSet.has(edgeKey)) {
                continue;
            }

            edgeSet.add(edgeKey);


            edges.push({
                from:
                    result.file,

                to:
                    req.resolvedPath,

                type:
                    "require",

                symbol:
                    req.local || null,

                imported:
                    null,

                line:
                    req.line,

                sourceLine:
                    null
            });
        }


        // ==================================================
        // 5. External ES module imports
        // ==================================================

        for (const imp of result.imports || []) {

            if (
                imp.type !== "external" ||
                !imp.package
            ) {
                continue;
            }


            const packageName =
                imp.package;


            // ----------------------------------------------
            // Find package ownership
            // ----------------------------------------------

            const packageInfo =
                resolvePackageProject(
                    packageName,
                    fileProject,
                    packageProjects
                );


            const packageProject =
                packageInfo.project;

            const pkg =
                packageInfo.package;


            // ----------------------------------------------
            // Build package node ID
            // ----------------------------------------------

            const packageId =
                getPackageNodeId(
                    packageProject,
                    packageName
                );


            // ----------------------------------------------
            // Package isn't present in package.json
            //
            // This can happen if:
            //
            // - package is transitive
            // - package.json is missing
            // - analyzer couldn't determine ownership
            //
            // Still create a package node so graph isn't lost.
            // ----------------------------------------------

            if (!packageNodeSet.has(packageId)) {

                packageNodeSet.add(packageId);

                nodes.push({

                    id:
                        packageId,

                    name:
                        packageName,

                    type:
                        "package",

                    project:
                        packageProject
                            ? packageProject.project
                            : null,

                    declaredVersion:
                        pkg
                            ? pkg.declaredVersion
                            : null,

                    installedVersion:
                        pkg
                            ? pkg.installedVersion
                            : null,

                    packageJson:
                        pkg
                            ? pkg.packageJson
                            : null,

                    lockfile:
                        pkg
                            ? pkg.lockfile
                            : null
                });
            }


            // ----------------------------------------------
            // File → package dependency edge
            // ----------------------------------------------

            const edgeKey =
                [
                    result.file,
                    packageId,
                    "dependency"
                ].join("|");


            if (edgeSet.has(edgeKey)) {
                continue;
            }

            edgeSet.add(edgeKey);


            edges.push({

                from:
                    result.file,

                to:
                    packageId,

                type:
                    "dependency",

                package:
                    packageName,

                project:
                    packageProject
                        ? packageProject.project
                        : null,

                line:
                    imp.line
            });
        }


        // ==================================================
        // 6. External CommonJS requires
        // ==================================================

        for (const req of result.requires || []) {

            if (
                req.type !== "external" ||
                !req.package
            ) {
                continue;
            }


            const packageName =
                req.package;


            const packageInfo =
                resolvePackageProject(
                    packageName,
                    fileProject,
                    packageProjects
                );


            const packageProject =
                packageInfo.project;

            const pkg =
                packageInfo.package;


            const packageId =
                getPackageNodeId(
                    packageProject,
                    packageName
                );


            // ----------------------------------------------
            // Make sure package node exists
            // ----------------------------------------------

            if (!packageNodeSet.has(packageId)) {

                packageNodeSet.add(packageId);

                nodes.push({

                    id:
                        packageId,

                    name:
                        packageName,

                    type:
                        "package",

                    project:
                        packageProject
                            ? packageProject.project
                            : null,

                    declaredVersion:
                        pkg
                            ? pkg.declaredVersion
                            : null,

                    installedVersion:
                        pkg
                            ? pkg.installedVersion
                            : null,

                    packageJson:
                        pkg
                            ? pkg.packageJson
                            : null,

                    lockfile:
                        pkg
                            ? pkg.lockfile
                            : null
                });
            }


            // ----------------------------------------------
            // File → package dependency edge
            // ----------------------------------------------

            const edgeKey =
                [
                    result.file,
                    packageId,
                    "require"
                ].join("|");


            if (edgeSet.has(edgeKey)) {
                continue;
            }

            edgeSet.add(edgeKey);


            edges.push({

                from:
                    result.file,

                to:
                    packageId,

                type:
                    "dependency",

                package:
                    packageName,

                project:
                    packageProject
                        ? packageProject.project
                        : null,

                line:
                    req.line
            });
        }


        // ==================================================
        // 7. API usages
        // ==================================================

        for (const usage of result.apiUsages || []) {

            if (!usage.package) {
                continue;
            }


            const packageName =
                usage.package;


            // ----------------------------------------------
            // Find package ownership
            // ----------------------------------------------

            const packageInfo =
                resolvePackageProject(
                    packageName,
                    fileProject,
                    packageProjects
                );


            const packageProject =
                packageInfo.project;

            const pkg =
                packageInfo.package;


            // ----------------------------------------------
            // Get package node ID
            // ----------------------------------------------

            const packageId =
                getPackageNodeId(
                    packageProject,
                    packageName
                );


            // ----------------------------------------------
            // Make sure package node exists
            // ----------------------------------------------

            if (!packageNodeSet.has(packageId)) {

                packageNodeSet.add(packageId);

                nodes.push({

                    id:
                        packageId,

                    name:
                        packageName,

                    type:
                        "package",

                    project:
                        packageProject
                            ? packageProject.project
                            : null,

                    declaredVersion:
                        pkg
                            ? pkg.declaredVersion
                            : null,

                    installedVersion:
                        pkg
                            ? pkg.installedVersion
                            : null,

                    packageJson:
                        pkg
                            ? pkg.packageJson
                            : null,

                    lockfile:
                        pkg
                            ? pkg.lockfile
                            : null
                });
            }


            // ----------------------------------------------
            // API usage edge
            // ----------------------------------------------

            const edgeKey =
                [
                    result.file,
                    packageId,
                    usage.api,
                    usage.line
                ].join("|");


            if (edgeSet.has(edgeKey)) {
                continue;
            }

            edgeSet.add(edgeKey);


            edges.push({

                from:
                    result.file,

                to:
                    packageId,

                type:
                    "api-usage",

                package:
                    packageName,

                project:
                    packageProject
                        ? packageProject.project
                        : null,

                api:
                    usage.api,

                apiType:
                    usage.type,

                local:
                    usage.local,

                line:
                    usage.line
            });
        }
    }


    // ==================================================
    // 8. Return graph
    // ==================================================

    return {
        nodes,
        edges
    };
}


export {
    buildDependencyGraph,
    findProjectForFile
};