import "dotenv/config";
import express from "express";
import cors from "cors";
import reportRoutes from "./routes/reporoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/repo", reportRoutes);

app.get("/health", (req, res) => {
    res.send("Hello World!");
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});