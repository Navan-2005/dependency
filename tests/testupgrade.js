import { analyzeUpgrade } from "../server/service/upgradeAnalyzer.js";
import "dotenv/config";

const result =
    await analyzeUpgrade(
        "../repos/Trade_book",
        "server",
        "jsonwebtoken",
        "9.0.0"
    );


console.log(
    JSON.stringify(
        result.llmAnalysis,
        null,
        2
    )
);