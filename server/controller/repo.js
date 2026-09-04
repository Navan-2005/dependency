import {simpleGit} from 'simple-git';
import {generate} from '../utils/util.js'
import {getAllFiles} from '../files/files.js'
import fs from "fs/promises";
import path from"path";
import {parse} from "@babel/parser";
import {getSourceFiles, extractImports, extractRequires,extractApiUsages} from '../service/analyze.js'
const clone=async(req,res)=>{
    try{
        const {repoUrl}=req.body;
        const git=simpleGit();
        const id=generate();
        const reponame=repoUrl.split("/").pop().split(".")[0];
        console.log(`Cloning repository from ${repoUrl} into ./repos/${reponame}`);
        await git.clone(repoUrl,`../repos/${reponame}`);
        const files=getAllFiles(`../repos/${reponame}`);
        res.status(200).json({reponame});
    } catch(error){
        res.status(500).json({Message : "Error in cloning the repository",error: error.message});
    }
}

const analyze=async(req,res)=>{
    try{
        const {reponame}=req.body;
        console.log(`Analyzing repository: ${reponame}`);
        const result=await analyzeJavaScript(`../repos/${reponame}`);
        res.status(200).json(result);
    } catch(error){
        res.status(500).json({Message : "Error in analyzing the repository",error: error.message});
    }
}



async function analyzeJavaScript(repoPath) {

    const files = await getSourceFiles(repoPath);
 
    console.log("Analyzing JavaScript files in repository:", repoPath);

    const results = [];

    for (const file of files) {

        const code = await fs.readFile(
            file,
            "utf-8"
        );

        let ast;

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
                `Could not parse ${file}`
            );

            continue;
        }

        const imports =
            extractImports(ast);

        const requires =
            extractRequires(ast);

         const apiUsages = extractApiUsages(ast, imports);


        results.push({
            file: path.relative(
                repoPath,
                file
            ),
            imports,
            requires,
            apiUsages
        });
    }

    return results;
}

export {clone, analyze};