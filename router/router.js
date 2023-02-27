const express = require("express");
const app = express();
const DEFAULT_LOCAL = process.env.DEFAULT_LOCAL || false;

const useRouter = async (env, isLocal = DEFAULT_LOCAL) => {
    return new Promise(r => {
        if(!env.PROJECT) throw new Error("No project specified");
        if(!env.ZONE) throw new Error("No zone specified");

        if(!env.INSTANCE_BUFFER) throw new Error("No instance buffer specified");
        if(!env.MAX_INSTANCES) throw new Error("No max instances specified");

        if(!env.PROJECT_NAME) throw new Error("No project name specified");

        const INSTANCE_BUFFER = parseInt(env.INSTANCE_BUFFER);
        const MAX_INSTANCES = parseInt(env.MAX_INSTANCES);

        
        const scaler = useScaler(env, isLocal);
        
        app.get(isLocal ? "/api/" : "/", async (req, res) => {
            // Statuses: [free, busy, starting]
        
            const startingAndFreeInstances = await scaler.fetchFreeNodes();
            const freeInstances = startingAndFreeInstances.filter(instance => instance.status === "free" && instance.externalIP);
        
            if(startingAndFreeInstances.length + 1 > MAX_INSTANCES) {
                console.log("Error: Max instances reached");
                res.status(500).send("Max instances reached");
                return;
            }
        
            let externalIP = false;
            if(freeInstances.length > 0) {
                externalIP = freeInstances[0].externalIP;
            }
        
            // await spawnServer();
        
            // Make sure there are INSTANCE_BUFFER + 1 freeInstances, otherwise await spawnServer() the gap
            if(startingAndFreeInstances.length < INSTANCE_BUFFER + 1) {
                const amountToSpawn = (INSTANCE_BUFFER + 1) - startingAndFreeInstances.length;
        
                console.log(`Not enough free instances, spawning ${amountToSpawn} more, ${startingAndFreeInstances.length} free/starting instances`);
                for(let i = 0; i < amountToSpawn; i++) {
                    await scaler.spawnNode();
                }
            }
        
            res.send(JSON.stringify({
                redirect: !!externalIP,
                externalIP
            }));
        });
        

        if(isLocal) {
            app.listen(3000, () => r({ app }));
        } else {
            r({ app });
        }
    });
}

const cleanRouter = async (env, isLocal = DEFAULT_LOCAL) => {
    if(isLocal) {
        // Clean up any old instances
        const dockerode = require("dockerode");
        const docker = new dockerode();

        const containers = await docker.listContainers();
        console.log(containers);
        let promises = [];
        for(let i = 0; i < containers.length; i++) {
            const container = containers[i];
            // if container starts with `ws-middleware-` delete it
            if(container.Names[0].startsWith("/ws-middleware-")) {
                const containerInstance = docker.getContainer(container.Id);
                promises.push(new Promise(async r => {
                    await containerInstance.stop();
                    await containerInstance.remove();
                    r();
                }));
            }
        }
        await Promise.all(promises);
    }
}

const { useScaler } = require("./scaler.js");

module.exports = {
    useRouter,
    cleanRouter
}