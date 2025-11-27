import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                index: path.resolve(__dirname, "index.html"),
                login: path.resolve(__dirname, "loginpage.html"),
                signup: path.resolve(__dirname, "signuppage.html"),
                sofiascalendar: path.resolve(__dirname, "sofiascalendar.html"),
                friends: path.resolve(__dirname, "friends.html"),
                sofiassettings: path.resolve(__dirname, "sofiassettings.html"),
                groupweeklyview: path.resolve("groupweeklyview.html"),
                sofiasnewedit: path.resolve(__dirname, "sofiasnewedit.html"),
                sofiasnewgroupedit: path.resolve(__dirname, "sofiasnewgroupedit.html"),
                sofiasnewweeklyview: path.resolve(__dirname, "sofiasnewweeklyview.html")
            },
        }
    }
});