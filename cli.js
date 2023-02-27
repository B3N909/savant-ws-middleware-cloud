#!/usr/bin/env node

const { Command } = require("commander");
const cli = new Command();

const util = require("./index.js");
const fs = require("fs");
const path = require("path");

// ws-middleware build
// ws-middleware test
// ws-middleware deploy


const getPath = (relativeDir) => {
    const p = path.join(process.cwd(), relativeDir);
    if(!fs.existsSync(p)) throw new Error(`Path ${p} does not exist`);
    return p;
}

const getProject = (path) => {
    return util.getProject(path);
}

cli
    .name("ws-middleware")
    .description("CLI tools for @savant/ws-middleware")
    .version("1.0.0");


// create command "deploy <server> --core --project <projectid>"
cli
    .command("build <dir>")
    .description("Build the docker container / router enviroment")
    .option("--core", "Only build the core container")
    .option("--router", "Only build the router container")
    .action(async (dirStr, options) => {
        // get full path
        const projectPath = getPath(dirStr);
        const project = getProject(projectPath);

        let buildCore = !!options.core;
        let buildRouter = !!options.router;

        if(!buildCore && !buildRouter) {
            buildCore = true;
            buildRouter = true;
        }


        if(buildCore) {
            await util.buildCore(projectPath);
        }

        if(buildRouter) {
            await util.buildRouter(project);
        }
    });

cli
    .command("deploy <dir>")
    .description("Deploy to GCP")
    .option("--core", "Only deploy the core container")
    .option("--router", "Only deploy the router container")
    .action(async (dirStr, options) => {

        const projectPath = getPath(dirStr);
        const project = getProject(projectPath);

        let deployCore = !!options.core;
        let deployRouter = !!options.router;

        if(!deployCore && !deployRouter) {
            deployCore = true;
            deployRouter = true;
        }


        let didDeployCore = false;
        if(deployCore) {
            // push core image
            didDeployCore = await util.deployCore(project);
        }

        let didDeployRouter = false;
        if(deployRouter) {
            didDeployRouter = await util.deployRouter(project);
        }

        console.log("\n");
        if(didDeployCore) console.log(" + Deployed core");
        if(didDeployRouter) console.log(" + Deployed router");
    });


cli
    .command("test")
    .description("Run a test container, the container logs is followed")
    .action(async () => {
        // create and run new docker container from image "test"
        await util.testCore();
    });



cli
    .command("clean <dir>")
    .description("Cleans existing GCP VM Instance, then starts minimum instances")
    .action(async (dirStr, projectName) => {
        const projectPath = getPath(dirStr);
        const project = getProject(projectPath);
        await util.fixInstances(project); 
    });
cli.parse(process.argv);