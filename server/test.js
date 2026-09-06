import { analyzePackageVersion } from "./service/packageApiAnalyzer.js";

const result =
    analyzePackageVersion(
        "prisma",
        "7.9.1"
    );


console.log(
    JSON.stringify(
        result,
        null,
        2
    )
);