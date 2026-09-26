const electron = require("electron");

electron.contextBridge.executeInMainWorld('electron', {
    // here all the functions will be exposed to the frontend that will be used by it to communicate with the backend.
    // it will be bidirectional so the frontend can call the backend and backend can call the frontend.
})