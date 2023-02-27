# @savant/ws-middleware-cloud
Provides a simple way to scale `@savant/ws-middleware` on Google Cloud Platform.


## Cloud Instance
Each Cloud Instance acts as a WebSocket connection handler for a single connection. Once the connection is closed, the instance is terminated and disposed of.

## Installation
```bash
npm install @savant/ws-middleware-cloud
```




## Commands & Features

### Deploy to GCP

You must setup a folder with a `package.json` including a `main` entry point. 

Example
```js
const { Host } = require("@savant/ws-middleware");

class RemoteClass {
    constructor () {
        this.value = 0;   
    }

    generate () {
        this.value = Math.random();
        return this.value;
    }

    get () {
        return this.value;
    }
}

Host(RemoteClass, {
    port: 8080,
});
```

```bash
ws-middleware deploy <folder_name>
```

Arguments | Description
--- | ---
`folder_name` | The name of the folder to deploy
`--project=` | The projectId of the GCP Project to deploy to

