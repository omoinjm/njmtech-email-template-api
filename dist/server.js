"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
/*
 * Load up and parse configuration details from
 * the `.env` file to the `process.env`
 * object of Node.js
 */
dotenv_1.default.config();
/*
 * Create an Express application and get the
 * value of the PORT environment variable
 * from the `process.env`
 */
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Static Files
app.use(express_1.default.static("public"));
app.use("/css", express_1.default.static(__dirname + "public/css"));
// Set Templating Engine
app.set("view engine", "ejs");
app.get("/", (req, res) => {
    res.render("pages/home", { title: "Email Template Api", showLogo: true });
});
app.get("/template", (req, res) => {
    // Extract the template name from query parameters
    const templateName = req.query.name;
    if (!templateName) {
        return res.status(400).send("Template name not provided");
    }
    res.render(`pages/${templateName}`, { title: "Thank you", showLogo: false });
});
/* Start the Express app and listen
 for incoming requests on the specified port */
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
