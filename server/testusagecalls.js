import {
    analyzeJavaScript
} from "./controller/repo.js";


const result =
    await analyzeJavaScript(
        "../repos/Trade_book"
    );


for (
    const file of result.files
) {

    if (
        !file.apiUsages ||
        file.apiUsages.length === 0
    ) {
        continue;
    }

    console.log(
        `\n${file.file}`
    );

    for (
        const usage of
        file.apiUsages
    ) {

        console.log(
            JSON.stringify(
                usage,
                null,
                2
            )
        );
    }
}