const { Client } = require("@savant/ws-middleware");

(async () => {

    const Animal = Client({
        "constructor": "",
        "generate": "",
        "get": "",
    }, "https://us-central1-chromesedge.cloudfunctions.net/api");

    const animal = new Animal();
    const generated = await animal.generate();
    console.log("generated " + generated);
    const value = await animal.get();
    console.log("value " + JSON.stringify(value));
})();