const child_process = require("child_process");
const ora = require("ora-classic");

const SetupCloud = () => {
    // deploy router/index.js function "api" to Google Cloud Functions
    
    const spinner = ora("Deploying API").start();

    // execute the command `gcloud functions deploy api --runtime nodejs10 --trigger-http --allow-unauthenticated --entry-point api --source router`
    child_process.exec("gcloud functions deploy api --runtime nodejs10 --trigger-http --allow-unauthenticated --entry-point api --source router --project chromesedge", (err, stdout, stderr) => {
        if(err) {
            const str = err.toString();
            if(str.includes(`For Cloud Build Logs, visit: `)) {
                const url = str.split(`For Cloud Build Logs, visit: `)[1].split(`\n`)[0];
                spinner.fail("Failed to deploy API. Please check the logs at " + url);
            } else {
                spinner.fail("Failed to deploy API");
                console.error(err);
            }
            return;
        }
        
        const str = stdout.toString();
        if(!str.includes("  url: ")) {
            spinner.fail("Failed to deploy API");
            console.log(str);
            return;
        }
        
        const url = str.split("  url: ")[1].split("\n")[0];
        spinner.succeed(`Deployed API, URL: ${url}`);
    });
}


module.exports = {
    SetupCloud
}