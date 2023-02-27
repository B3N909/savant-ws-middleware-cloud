const EXPIRY_TIME = 1000 * 20;
const path = require("path");
const dockerode = require("dockerode");
let docker;

class Scaler {
    constructor (options) {
        if(!options) throw new Error("No options provided");
        if(!options.spawnNode) throw new Error("No spawnNode function provided");
        if(!options.fetchFreeNodes) throw new Error("No fetchFreeNodes function provided");

        this._spawnNode = options.spawnNode;
        this._fetchFreeNodes = options.fetchFreeNodes;
    }

    // spawns a new node
    async spawnNode () {
        return await this._spawnNode();
    }

    // fetches all nodes from the db
    async fetchFreeNodes () {
        return await this._fetchFreeNodes();
    }
}

const useScaler = async (env, isLocal = false) => {
    if(!env.PROJECT_NAME) throw new Error("No project name specified");
    
    if(isLocal) {
        const nodesDb = new Map();
        docker = new dockerode();

        // get local ipv4
        const localIP = await new Promise((r, e) => {
            require("dns").lookup(require("os").hostname(), (err, add, fam) => {
                if(err) e(err);
                else r(add);
            });
        });

        const network = await docker.createNetwork({
            Name: "ws-middleware",
            CheckDuplicate: true,
        });

        return new Scaler({
            spawnNode: async () => {
                const uniqueName = "ws-middleware-" + Date.now();

                // start / create docker container:
                // - name: uniqueName
                // - image: core-build
                // - env: INSTANCE_NAME=uniqueName
                // allow access to host network

                const container = await docker.createContainer({
                    name: uniqueName,
                    Image: env.PROJECT_NAME,
                    Env: [
                        "INSTANCE_NAME=" + uniqueName,
                        "LOCAL=true",
                    ],
                    HostConfig: {
                        NetworkMode: "ws-middleware",
                    },
                    ExtraHosts: [
                        "ws-middleware:
                });

                
                // start container
                await container.start();

                // TODO: CONTAINER NAME SHOULD BE UNANIMOUS
                nodesDb.set(uniqueName, {
                    status: "starting",
                    time: Date.now(),
                    externalIP: "",
                    name: uniqueName,
                });
            },
            fetchFreeNodes: async () => {
                const values = Array.from(nodesDb.values());
                const filtered = values.filter(e => {
                    if(e.status === "free" && e.time < Date.now() - EXPIRY_TIME) {
                        return false;
                    }
                    return true;
                });
                return filtered;
            }
        })
    } else {
        const Compute = require("@google-cloud/compute");
        const { Datastore } = require("@google-cloud/datastore");
        const instanceClient = new Compute.InstancesClient();
        const templateClient = new Compute.InstanceTemplatesClient();
        const datastore = new Datastore();

        return new Scaler({
            spawnNode: async () => {
                const uniqueName = "ws-middleware-" + Date.now();

                const entity = {
                    key: datastore.key(["VMInstance", uniqueName]),
                    data: {
                        status: "starting",
                        time: Date.now(),
                        externalIP: "",
                        name: uniqueName,
                    }
                };
            
                await datastore.save(entity);
            
            
                // get gcp instance template named TEMPLATE
                const [template] = await templateClient.get({
                    project: options.project,
                    instanceTemplate: options.template,
                });
                
                // spawn new VM instance from template above
                // use Datastore Permissions
                const [instance] = await instanceClient.insert({
                    project: options.project,
                    zone: options.zone,
                    instanceResource: {
                        name: uniqueName,
                        serviceAccounts: [
                            {
                                email: "default",
                                scopes: [
                                    "https://www.googleapis.com/auth/cloud-platform",
                                    "https://www.googleapis.com/auth/datastore"
                                ],
                            },
                        ],
                    },
                    sourceInstanceTemplate: template.selfLink,
                });
            
                console.log("Instance created");
                return true;
            },
            fetchFreeNodes: async () => {
                // return all datastore entities of kind VMInstance with status == "starting" and time >= Date.now() - EXPIRY_TIME - options.instanceStartupTime,
                const query = datastore.createQuery("VMInstance").filter("time", ">=", Date.now() - EXPIRY_TIME - options.instanceStartupTime);
                const [entities] = await datastore.runQuery(query);
                // if any entities with status "free" and time older then Date.now() - EXPIRY_TIME, remove them from our array
                const filtered = entities.filter(e => {
                    if(e.status === "free" && e.time < Date.now() - EXPIRY_TIME) {
                        return false;
                    }
                    return true;
                });
                return filtered;
            }
        })
    }
}

module.exports = { useScaler };