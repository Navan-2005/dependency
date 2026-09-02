import express from "express";
const router = express.Router();
import { clone } from "../controller/repo.js";

router.post("/clone", clone)

export default router