// server.ts
import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";

/*
 * Load up and parse configuration details from
 * the `.env` file to the `process.env`
 * object of Node.js
 */
dotenv.config();

/*
 * Create an Express application and get the
 * value of the PORT environment variable
 * from the `process.env`
 */
const app: Express = express();
const port = process.env.PORT || 3000;

// Static Files
app.use(express.static(__dirname + "/assets"));
app.use("/css", express.static(__dirname + "assets/css"));

// Set Templating Engine
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

app.get("/", (req: Request, res: Response) => {
  res.render("pages/home", {
    title: "Email Template Api",
    isHome: true,
  });
});

app.get("/template", (req: Request, res: Response) => {
  // Extract the template name fom query parameters
  const { name, first_name } = req.query;

  const requiredParams = ["name", "first_name"];
  const missingParams = requiredParams.filter((param) => !req.query[param]);

  if (missingParams.length > 0) {
    return res.status(400).json({ error: "Missing parameters", missingParams });
  }

  res.render(`pages/${name}`, {
    title: "Thank you",
    isHome: false,
    displayName: first_name,
  });
});

/* Start the Express app and listen for incoming requests on the specified port */
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
