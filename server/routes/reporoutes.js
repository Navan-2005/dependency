import express from "express";
const router = express.Router();
import { clone , analyze, analyzeImpact} from "../controller/repo.js";
import { analyzeUpgrade } from "../service/upgradeAnalyzer.js";

router.post("/clone", clone)
router.post("/analyze", analyze)
router.post('/analyze/repo/impact',analyzeImpact)

router.post(
    "/analyze/impact",
    async (req, res) => {
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

            return res.json(result);

        } catch (error) {

            console.error(
                "Upgrade analysis failed:",
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }
    }
);
export default router