import { app } from "electron";
import path from "node:path";
import { isDev } from "./util.js";

export function getPreloadPath(): string {
    return path.join(
        app.getAppPath(),
        isDev() ? '.' : '..',
        '/dist-electron/preload.cjs',
    )
}