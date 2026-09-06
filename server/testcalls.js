import {
    analyzeFileCallSites
} from "./service/callSiteAnalyzer.js";


const file =
    "../repos/Trade_book/server/middleware/middleware.js";


const calls =
    analyzeFileCallSites(
        file
    );


console.log(
    JSON.stringify(
        calls,
        null,
        2
    )
);