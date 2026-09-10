import { analyze, analyzeJavaScript } from "../server/controller/repo.js";



const repoPath =
    "../repos/Trade_book";

    import {
    findPackageUsages
} from "../server/service/apiImpactMatcher.js";


const result =
    await analyzeJavaScript(
        repoPath
    );


for (
    const file of result.files
) {

    if (
        file.apiUsages &&
        file.apiUsages.length > 0
    ) {

        console.log(
            "\n================================"
        );

        console.log(
            "FILE:",
            file.file
        );

        console.log(
            "API USAGES:"
        );

        console.log(
            "\nRepository usages of",
            packageName
        );

        console.dir(
            findPackageUsages(
                repositoryAnalysis,
                packageName
            ),
            {
                depth: null
            }
        );

        console.dir(
            file.apiUsages,
            {
                depth: null
            }
        );
    }
}