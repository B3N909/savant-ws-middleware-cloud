const { Browser, WebPortal } = require("@savant/chrome-core");
const { Host } = require("@savant/ws-middleware")(true);

WebPortal.start();

module.exports = Host(Browser);