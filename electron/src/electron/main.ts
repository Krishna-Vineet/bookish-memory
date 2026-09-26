import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { isDev } from './util.js'
import { getPreloadPath } from './pathResolver.js'


app.on('ready', () => {
    const mainWindow = new BrowserWindow({
        webPreferences: {
            preload: getPreloadPath(),
        }
    })

    if (isDev()) {
        mainWindow.loadURL('http://localhost:8888')
        console.log("Testing again")
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), "./dist-react/index.html"))
    }
})

export default app;