const { cleanRouter, useRouter } = require("./router/router.js");

const path = require("path");
const envPath = path.join(__dirname, "./api/.env");
const env = require("dotenv").config({ path: envPath }).parsed;

cleanRouter(env, true)
    .then(useRouter(env, true))
    .then(() => console.log("Router ready!\nhttp://127.0.0.1:3000/api"));
