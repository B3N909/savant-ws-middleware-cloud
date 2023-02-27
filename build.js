const { Browser } = require("@savant/chrome-core");
const { SetupCloud } = require("./index.js");

(async () => {

    SetupCloud("example", {
        target: "both",
        project: "chromesedge",
        zone: "us-central1-a",
        instances: {
            min: 1,
            buffer: 2,
            max: 10,
            startup: 1000 * 60 * 2,
        }
    });

})();