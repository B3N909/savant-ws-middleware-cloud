const log = (...args) => console.log("ws-middleware: ", ...args);
const request = require("request");
const KEEP_ALIVE_INTERVAL = 1000 * 15;

(async () => {
    console.log("ws-middleware: Starting...");
    const isLocal = !!process.env.LOCAL;

    const server = require("./core/index.js");
    if(!server || !server.isServer) throw new Error("Core has no exported ws-middleware server");

    // load ./core/.env to a JSON object
    const dotenv = require("dotenv");
    const env = dotenv.config({ path: "./core/.env" });
    const PROJECT_ID = env.parsed.PROJECT_ID;
    const ZONE = env.parsed.ZONE;
    const INSTANCE_NAME = process.env.HOSTNAME;

    if(!PROJECT_ID) throw new Error("No project id provided");
    if(!ZONE) throw new Error("No zone provided");
    if(!INSTANCE_NAME) throw new Error("No instance name provided");

    
    let getExternalAddress;
    let killSelf;
    let updateState;
    
    if(isLocal) {

        getExternalAddress = () => {
            // get local ipv4 docker address
            return new Promise(r => {
                const os = require("os");
                const ifaces = os.networkInterfaces();
                let ip = false;
                Object.keys(ifaces).forEach(ifname => {
                    ifaces[ifname].forEach(iface => {
                        if("IPv4" !== iface.family || iface.internal !== false) return;
                        ip = iface.address;
                    });
                });
                r(ip);
            });
        };
        
        killSelf = () => {
            return new Promise(r => {
                r();
            });
        };

        updateState = (state) => {
            return new Promise(r => {
                r();
            });
        };

    } else {
        const { Datastore } = require("@google-cloud/datastore");
        const datastore = new Datastore();
        
        const compute = require("@google-cloud/compute");
        const instanceClient = new compute.InstancesClient();

        getExternalAddress = () => {
            return new Promise(r => {
                request({
                    url: "https://api.ipify.org?format=json",
                    method: "GET",
                    json: true
                }, (err, resp, body) => {
                    if(err || !resp || !resp.statusCode) {
                        if(err) throw err;
                        if(body) console.log(body);
                        if(resp && resp.statusCode) console.log(resp.statusCode);
                        r(false);
                    }
                    if(!body.ip) {
                        console.log("No IP provided", body);
                        r(false);
                    }
                    r(body.ip);
                });
            });
        };

        killSelf = async () => {
            try {
                // INSTANCE_NAME is our vm instance name to delete
                const [operation] = await instanceClient.delete({
                    instance: INSTANCE_NAME,
                    project: PROJECT_ID,
                    zone: ZONE,
                });
                // Wait for the operation to complete.
                await operation.promise();
                console.log(`Deleted instance ${INSTANCE_NAME}`);
                return true;
            } catch(err) {
                console.log("Error deleting instance", err);
                return false;
            }
        }

        updateState = async (data) => {
            const getInstanceData = async () => {
                const [instance] = await datastore.get(datastore.key(["VMInstance", INSTANCE_NAME]));
                return instance || {};
            }
            // only update the data that is passed in, otherwise don't overwrite
            const instance = await getInstanceData();
            const newData = { ...instance, ...data };
            await datastore.save({ key: datastore.key(["VMInstance", INSTANCE_NAME]), data: newData });
        }

    }


    
    

    const EXTERNAL_IP = await getExternalAddress();
    if(!EXTERNAL_IP) throw new Error("No external IP provided");
    console.log("External IP", EXTERNAL_IP);
    


    const maxConnections = server.maxConnections();

    updateState({
        externalIP: EXTERNAL_IP,
        status: "free",
        time: Date.now(),
        name: INSTANCE_NAME,
        maxConnections,
        connections: 0,
    });
    log("onSpawn", "free", 0);

    server.onConnect((e) => {
        const status = e.connections == e.maxConnections ? "busy" : "free";
        const { connections } = e;

        updateState({
            status,
            connections,
        });
        log("onConnect", status, connections)
    });
    
    let keepAliveInterval = setInterval(() => {
        const time = Date.now();
        updateState({ time });
        log("keepalive", time);
    }, KEEP_ALIVE_INTERVAL);

    server.onDisconnect(async (e) => {
        // destroy vm instance
        clearInterval(keepAliveInterval);
        killSelf();
        server.close();
    });

})();