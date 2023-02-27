const { useRouter } = require("./router.js");
module.exports.api = useRouter(require("dotenv").config().parsed, false).app;