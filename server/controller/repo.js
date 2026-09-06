import { simpleGit } from 'simple-git';
import { generate } from '../utils/util.js';
import { getAllFiles } from '../files/files.js';
import {extractExports} from '../service/exportResolver.js';
import { resolveLocalImports } from '../service/symbolResolver.js';
import { buildDependencyGraph } from '../service/dependencyGraph.js';
import { getPackageVersions } from '../service/packageResolver.js';
import { comparePackageVersion } from '../service/versionComparator.js';
import {
    analyzeCallSites
} from "../service/callSiteAnalyzer.js";

import {
    enrichApiUsages
} from "../service/callSiteMatcher.js";

import fs from "fs/promises";
import path from "path";

import { parse } from "@babel/parser";

import {
    getSourceFiles,
    extractImports,
    extractRequires,
    extractApiUsages
} from '../service/analyze.js';

import {
    resolveImport
} from "../service/moduleResolver.js";
import { analyzeUpgrade } from '../service/upgradeAnalyzer.js';


// ==========================================================
// CLONE
// ==========================================================

const clone = async (req, res) => {

    try {

        const { repoUrl } = req.body;

        const git = simpleGit();

        const id = generate();

        const reponame =
            repoUrl
                .split("/")
                .pop()
                .split(".")[0];


        console.log(
            `Cloning repository from ${repoUrl} into ./repos/${reponame}`
        );


        await git.clone(
            repoUrl,
            `../repos/${reponame}`
        );


        const files =
            getAllFiles(
                `../repos/${reponame}`
            );


        res.status(200).json({
            reponame
        });

    } catch (error) {

        res.status(500).json({
            Message: "Error in cloning the repository",
            error: error.message
        });
    }
};


// ==========================================================
// ANALYZE
// ==========================================================

const analyze = async (req, res) => {

    try {

        const { reponame } = req.body;


        console.log(
            `Analyzing repository: ${reponame}`
        );


        const result =
            await analyzeJavaScript(
                `../repos/${reponame}`
            );


        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({
            Message: "Error in analyzing the repository",
            error: error.message
        });
    }
};


// ==========================================================
// ANALYZE JAVASCRIPT
// ==========================================================

async function analyzeJavaScript(repoPath) {

    const files =
        await getSourceFiles(repoPath);


    console.log(
        "Analyzing JavaScript files in repository:",
        repoPath
    );


    const results = [];


    for (const file of files) {

        const code =
            await fs.readFile(
                file,
                "utf-8"
            );


        let ast;


        // --------------------------------------------------
        // Parse AST
        // --------------------------------------------------

        try {

            ast = parse(code, {

                sourceType: "unambiguous",

                plugins: [
                    "jsx",
                    "typescript"
                ],

                ranges: true,

                locations: true
            });

        } catch (error) {

            console.log(
                `Could not parse ${file}: ${error.message}`
            );

            continue;
        }


        // --------------------------------------------------
        // Extract imports
        // --------------------------------------------------

        const imports = extractImports(ast);

        const resolvedImports = imports.map((imp) => {
            const resolved = resolveImport(
                imp.importPath,
                file,
                repoPath
            );

            return {
                ...imp,
                type: resolved.type,
                package: resolved.package,
                resolvedPath: resolved.resolvedPath
            };
        });

        const exports = extractExports(ast);

        const requires = extractRequires(ast);

        const apiUsages = extractApiUsages(
            ast,
            resolvedImports
        );

        const callSites =
        analyzeCallSites(
            file,
            code
        );


        // --------------------------------------------------
        // Store result
        // --------------------------------------------------

        results.push({
            file: path.relative(repoPath, file).replace(/\\/g, "/"),
            imports: resolvedImports,
            exports,
            requires,
            callSites,
            apiUsages
        });
    }

    enrichApiUsages(
    results
);

    resolveLocalImports(results);

    const packages = getPackageVersions(repoPath);

    const dependencyGraph = buildDependencyGraph(results);

    return { files: results, dependencyGraph , packages };
}

const analyzeImpact=async(req,res)=>{
     try {

            const {
                reponame,
                project,
                package: packageName,
                targetVersion
            } = req.body;


            if (
                !reponame ||
                !project ||
                !packageName ||
                !targetVersion
            ) {

                return res.status(400).json({
                    error:
                        "reponame, project, package and targetVersion are required"
                });
            }


            const repoPath =
                `../repos/${reponame}`;


            const result =
                await analyzeUpgrade(
                    repoPath,
                    project,
                    packageName,
                    targetVersion
                );


            return res.json(
                result
            );

        }
        catch (error) {

            console.error(
                error
            );


            return res.status(500).json({
                error:
                    error.message
            });
        }
    }

async function analyzeUpgradeImpact(
    repoPath,
    projectName,
    packageName,
    targetVersion
) {

    // ---------------------------------------------
    // Get all package information
    // ---------------------------------------------

    const packageProjects =
        getPackageVersions(repoPath);


    // ---------------------------------------------
    // Find requested project
    // ---------------------------------------------

    const project =
        packageProjects.find(
            (item) =>
                item.project === projectName
        );


    if (!project) {

        throw new Error(
            `Project '${projectName}' not found`
        );
    }


    // ---------------------------------------------
    // Find requested package
    // ---------------------------------------------

    const pkg =
        project.packages.find(
            (item) =>
                item.name === packageName
        );


    if (!pkg) {

        throw new Error(
            `Package '${packageName}' not found in project '${projectName}'`
        );
    }


    // ---------------------------------------------
    // Compare versions
    // ---------------------------------------------

    const versionChange =
        comparePackageVersion(
            packageName,
            projectName,
            pkg.installedVersion,
            targetVersion
        );


    // ---------------------------------------------
    // Return upgrade information
    // ---------------------------------------------

    return {

        package:
            packageName,

        project:
            projectName,

        packageJson:
            pkg.packageJson,

        lockfile:
            pkg.lockfile,

        declaredVersion:
            pkg.declaredVersion,

        currentVersion:
            pkg.installedVersion,

        targetVersion:
            versionChange.targetVersion,

        changeType:
            versionChange.changeType
    };
}

// ==========================================================
// EXPORT
// ==========================================================

export {
    clone,
    analyze,
    analyzeUpgradeImpact,
    analyzeImpact,
    analyzeJavaScript
};