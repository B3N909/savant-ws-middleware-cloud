
const os = require("os");
const { Datastore } = require("@google-cloud/datastore");
const datastore = new Datastore();


let instanceEntityData = {};

(async () => {
    console.log("Starting...");

    const externalIP = os.networkInterfaces().eth0[0].address;
    instanceEntityData = {
        externalIP,
        isFree: true,
        time: Date.now()
    }

    // save instanceEntityData as a datastore entity data for kind "VMInstance" with custom name "chrome-core-" + externalIP
    await datastore.save({
        key: datastore.key(["VMInstance", "chrome-core-" + externalIP]),
        data: instanceEntityData
    });

    console.log("Added VM Instance to Datastore as \"chrome-core-" + externalIP + "\"");
})();