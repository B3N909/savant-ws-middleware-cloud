const GCPCompute = require("@google-cloud/compute");
const { Datastore } = require("@google-cloud/datastore");

const compute = new GCPCompute();
const datastore = new Datastore();

const express = require("express");
const app = express();

const getFreeVMInstance = async () => {
    try {
        // find Datastore entity with kind "VMInstance", property "isFree" as true, has property externalIP, and has propert time that is greater then Date.now() - EXPIRY_TIME
        // if no Datastore entity is found, return false

        const query = datastore.createQuery("VMInstance").filter("isFree", "=", true).filter("externalIP", "!=", null).filter("time", ">=", Date.now() - EXPIRY_TIME);
        const [entities] = await datastore.runQuery(query);
        if(entities.length === 0) return false;

        const entity = entities[0];
        entity.isFree = false;
        await datastore.update(entity);

        // get the externalIP
        const externalIP = entity.externalIP;
        return externalIP;
    } catch (err) {
        console.error(err);
        return -1;
    }
}

app.get("/", async (req, res) => {

    // find VM Instance that both starts with "chrome-core-" in name as well as has the tag "Core-Free"
    // if no VM Instance is found, return 404
    // if VM Instace is found, immediately remove the tag and send the VM Instance's external IP address to the client

    const externalIP = await getFreeVMInstance();
    if(externalIP === -1) return res.status(500).send("Internal Server Error");
    if(!externalIP) return res.status(404).send("No VM Instances available");
    res.send(externalIP);
});

module.exports.api = app;