const { Browser } = require("@savant/chrome-core");
const { SetupCloud } = require("./index.js");

(async () => {

    SetupCloud(Browser, {
        instances: {
            min: 1,
            max: 10,
            startup: 1000 * 60 * 2,
        }
    });

})();