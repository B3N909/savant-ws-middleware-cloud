const child_process = require("child_process");
const ora = require("ora-classic");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const colors = require("colors");
const { hasChanged } = require("@savant/fs-cache");
const readline = require("readline");
const dotenv = require("dotenv");

const ZONE = "us-central1-a";

const buildCore = async (projectPath) => {
    return await new Promise(finalResolve => {
        const setup2Spinner = ora("Setting up Core").start();

        const sourcePath = projectPath;
        const containerPath = path.join(__dirname, "./container/core");

        if(!fs.existsSync(containerPath)) {
            fse.mkdirSync(containerPath);
        }

        const sourceDidChange = hasChanged("core-source", sourcePath, ["cache.json"]);
        const containerDidChange = hasChanged("core-container", containerPath, ["core"]);

        if(!sourceDidChange && !containerDidChange) {
            setup2Spinner.info("Core already setup- no changes");
            finalResolve(false);
        } else {
            // copy folderName to ./container as core
            // but first, destroy containerPath so we don't have any old files

            // delete containerPath directory

            const sourceEnv = dotenv.config({ path: path.join(sourcePath, ".env") }).parsed;
            if(!sourceEnv) {
                setup2Spinner.fail("Failed to setup Core");
                console.error("No .env file found in Core source");
                finalResolve(false);
                return;
            }

            const projectName = sourceEnv.PROJECT_NAME;

            child_process.exec(`rmdir /s /q "${containerPath}"`, err => {
                if(err) {
                    setup2Spinner.fail("Failed to setup Core");
                    console.error(err);
                    finalResolve(false);
                    return;
                }

                child_process.exec(`xcopy /E /I "${sourcePath}" "${containerPath}"`, { maxBuffer: 1024 * 1024 * 1000 }, err => {
                    if(err) {
                        setup2Spinner.fail("Failed to setup Core");
                        console.error(err);
                        finalResolve(false);
                        return;
                    }

                    setup2Spinner.succeed("Core setup complete");
    
                    const testSpinner = ora("Building Core").start();
                    // test if the server.js starts a WebSocket server on port 3000, set enviromental variable "TEST" to true
                    child_process.exec(`cd ${path.join(__dirname, "./container")} && docker build -t ${projectName} .`, (err, stdout, stderr) => {
                        if(err) {
                            testSpinner.fail("Failed to test build Core");
                            console.error(err);
                            finalResolve(false);
                            return;
                        }
                        // console.log(stdout.gray);
    
                        testSpinner.succeed("Core built");
    
                        finalResolve(true);
                    });
                });
            });
        }
    });
}

const testCore = async (projectName) => {
    return await new Promise(finalResolve => {
        const runSpinner = ora("Starting Core Test").start();

        // if container-test exists already, delete it
        child_process.exec(`docker rm -f container-test`, async (err, stdout, stderr) => {
            if(err) {
                console.error(err);
                finalResolve(false);
                return;
            }

            // if(stderr) {
            //     // console.error(stderr);
            //     finalResolve(false);
            //     return;
            // }

            // run container-test

            const container = child_process.spawn("docker", ["run", "-e", "TEST=true", "-p", "3000:3000", "-p", "3001:3001", "-p", "3002:3002", "-p", "3003:3003", "-p", "5900:5900", "-d", "--name", "container-test", projectName], {
                cwd: path.join(__dirname, "./container")
            });

            container.stdout.on("data", data => {
                // console.log(data.toString());
            });

            runSpinner.succeed("Core started");

            await new Promise(r => setTimeout(r, 1000));

            let currentLogs = "";
            const logs = () => {
                child_process.exec(`docker logs container-test`, (err, stdout, stderr) => {
                    if(err) {
                        console.error(err);
                        finalResolve(false);
                        return;
                    }
        
                    if(stderr) {
                        console.error(stderr);
                        finalResolve(false);
                        return;
                    }
                    
                    if(stdout.length > 0) {
                        if(currentLogs !== "") {
                            if(stdout.includes(currentLogs)) {
                                stdout = stdout.split(currentLogs)[1];
                                if(stdout.length > 0) {
                                    currentLogs += stdout;
                                    console.log(stdout.gray.italic);
                                }
                            } else {
                                console.error("FATAL ERROR HOMES!?");
                            }
                        } else {
                            currentLogs = stdout;
                            // console.log("\n\nStart of logs:\n");
                            console.log(stdout.gray.italic);
                        }
                    }
                    logs();
                });
            }
            logs();

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question("\nPress any key to exit...".cyan.bold, () => {
                rl.close();
                finalResolve(true);
            });
            console.log("\n");
        });
    });
}

const deployCore = async (project) => {
    return new Promise(finalResolve => {
        const tagSpinner = ora("Pushing Core Image").start();
        // tag the image "test" as "gcr.io/[PROJECT]/folderName"
        child_process.exec(`docker tag ${project.projectName} gcr.io/${project.projectId}/${project.projectName}`, (err, stdout, stderr) => {
            if(err) {
                tagSpinner.fail("Failed to tag Core image");
                console.error(err);
                finalResolve(false);
                return;
            }

            child_process.exec(`docker push gcr.io/${project.projectId}/${project.projectName}`, async (err, stdout, stderr) => {
                if(err) {
                    tagSpinner.fail("Failed to push Core image");
                    console.error(err);
                    finalResolve(false);
                    return;
                }

                tagSpinner.succeed("Pushed Core image");

                finalResolve(true);
            });
        });
    });
}

const buildRouter = async (project) => {
    const spinner = ora("Building Router").start();
    const enviroment = {
        MIN_INSTANCES: project.minInstances,
        INSTANCE_BUFFER: project.bufferInstances,
        MAX_INSTANCES: project.maxInstances,
        INSTANCE_STARTUP_TIME: project.instanceStartupTime,


        PROJECT_NAME: project.projectName,
        PROJECT: project.projectId,
        IMAGE: `gcr.io/${project.projectId}/${project.projectName}`,
        ZONE: project.zone,
        MACHINE_TYPE: "n1-standard-1",
        TEMPLATE: `${project.projectName}-template`,
    }
    let env = "";
    for(const key in enviroment) {
        env += `${key}=${enviroment[key]}\n`;
    }
    fs.writeFileSync(path.join(__dirname, "./api/.env"), env);
    spinner.succeed("Router setup complete");
}

const deployRouter = async (project) => {
    return await new Promise(finalResolve => {
        
        const routerPath = path.join(__dirname, "./api");

        const routerDidChange = hasChanged("router", routerPath);
        const spinner = ora("Deploying Router").start();
        if(routerDidChange) {
            // execute the command `gcloud functions deploy api --runtime nodejs10 --trigger-http --allow-unauthenticated --entry-point api --source router`
            child_process.exec(`cd ${__dirname} && gcloud functions deploy api --runtime nodejs10 --trigger-http --allow-unauthenticated --entry-point api --source api --project ${project.projectId}`, async (err, stdout, stderr) => {
                if(err) {
                    const str = err.toString();
                    if(str.includes(`For Cloud Build Logs, visit: `)) {
                        const url = str.split(`For Cloud Build Logs, visit: `)[1].split(`\n`)[0];
                        spinner.fail("Failed to deploy API. Please check the logs at " + url);
                    } else {
                        spinner.fail("Failed to deploy API");
                        console.error(err);
                    }
                    finalResolve(false);
                    return;
                }
                
                const str = stdout.toString();
                if(!str.includes("  url: ")) {
                    spinner.fail("Failed to deploy API");
                    console.log(str);
                    finalResolve(false);
                    return;
                }
                
                const url = str.split("  url: ")[1].split("\n")[0];
                if(url) spinner.succeed(`Deployed Router, Endpoint: ${url}`);
                else spinner.fail("Failed to deploy API, no URL found");
                finalResolve(true);
            });
        } else {
            spinner.info("Router already setup- no changes");
            finalResolve(false);
        }
    });
}

const fixInstances = async (project) => {
    return await new Promise(async finalResolve => {
        await new Promise(r => {
            const instancePrefix = "ws-middleware-";

            // use gcloud company to destroy all vm instances
            const destroySpinner = ora("Finding existing VM instances").start();

            // list both name:zone
            child_process.exec(`gcloud compute instances list --filter="name~^${instancePrefix}" --format="value(name,zone)" --project ${project.projectId}`, async (err, stdout, stderr) => {
                if(err) {
                    destroySpinner.fail("Failed to list VM instances");
                    console.error(err);
                    return;
                }

                const lines = stdout.toString().split("\n").filter(i => i);
                if(lines.length === 0) {
                    destroySpinner.succeed("No VM instances found");
                    r();
                    return;
                } else {
                    destroySpinner.succeed(`Found ${lines.length} VM instances`);

                    
                    const deleteSpinner = ora("Deleting VM instances").start();

                    let promises = [];

                    for(let i = 0; i < lines.length; i++) {
                        let line = lines[i];
                        // remove excess whitespace
                        line = line.replace(/\s+/g, " ");
                        const instance = line.split(" ")[0];
                        const zone = line.split(" ")[1];


                        promises.push(new Promise(r => {
                            child_process.exec(`gcloud compute instances delete ${instance} --zone ${zone} --project ${project.projectId} --quiet`, (err, stdout, stderr) => {
                                if(err) {
                                    console.error(err);
                                    r();
                                    return;
                                }
                                r();
                            });
                        }));
                    }


                    await Promise.all(promises);
                    deleteSpinner.succeed(`Deleted ${promises.length} VM instances`);

                    r();
                }
            });
        })

        // START MINIMUM INSTANCES
        await new Promise(async r => {
            const groupSpinner = ora("Starting minimum instances").start();
            groupSpinner.succeed("Starting minimum " + project.minInstances + " instances"); 
            for(let i = 0; i < project.minInstances; i++) {
                // create instance from template

                await new Promise(resolve => {
                    const instanceName = `ws-middleware-${Date.now()}`;
                    const createSpinner = ora("Creating " + instanceName).start();
                    child_process.exec(`gcloud compute instances create ${instanceName} --zone ${project.zone} --project ${project.projectId} --source-instance-template ${project.projectName}-template --scopes=datastore,default`, async (err, stdout, stderr) => {
                        if(err) {
                            createSpinner.fail("Failed to create instance");
                            console.error(err);
                            resolve();
                            return;
                        }
                        createSpinner.succeed("Created instance");
                        resolve();
                    });
                });
            }
            r();
        });

        finalResolve(true);
    });
}

const getProject = (path) => {
    // from path look for a .env file, if none found return false
    const envPath = path + "/.env";
    if(!fs.existsSync(envPath)) throw new Error("No .env file found in " + path);
    // convert to object
    const env = dotenv.parse(fs.readFileSync(envPath));
    
    if(!env.PROJECT_ID) throw new Error("No PROJECT_ID found in .env file");
    if(!env.PROJECT_NAME) throw new Error("No PROJECT_NAME found in .env file");
    if(!env.ZONE) throw new Error("No ZONE found in .env file");
    if(!env.MIN_INSTANCES) throw new Error("No MIN_INSTANCES found in .env file");
    if(!env.MAX_INSTANCES) throw new Error("No MAX_INSTANCES found in .env file");
    if(!env.BUFFER_INSTANCES) throw new Error("No BUFFER_INSTANCES found in .env file");
    if(!env.INSTANCE_STARTUP_TIME) throw new Error("No INSTANCE_STARTUP_TIME found in .env file");

    return {
        projectId: env.PROJECT_ID,
        projectName: env.PROJECT_NAME,
        zone: env.ZONE,
        minInstances: parseInt(env.MIN_INSTANCES),
        maxInstances: parseInt(env.MAX_INSTANCES),
        bufferInstances: parseInt(env.BUFFER_INSTANCES),
        instanceStartupTime: parseInt(env.INSTANCE_STARTUP_TIME),
    }
}

module.exports = {
    buildCore,
    buildRouter,
    testCore,
    deployCore,
    deployRouter,
    fixInstances,
    
    getProject
}


// 
// Agents the pawn of entities