import express from "express";
const router = express.Router();
import { clone , analyze} from "../controller/repo.js";

router.post("/clone", clone)
router.post("/analyze", analyze)

export default router