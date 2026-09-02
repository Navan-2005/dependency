import {simpleGit} from 'simple-git';
import {generate} from '../utils/util.js'
const clone=async(req,res)=>{
    try{
        const {repoUrl}=req.body;
        const git=simpleGit();
        const id=generate();
        console.log(`Cloning repository from ${repoUrl} into ./repos/${id}`);
        await git.clone(repoUrl,`../repos/${id}`);
        res.status(200).json({id});
    } catch(error){
        res.status(500).json({Message : "Error in cloning the repository",error: error.message});
    }
}

export {clone};