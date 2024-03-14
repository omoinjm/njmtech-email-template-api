// server.ts
import express, { Router, Express, Request, Response } from "express";
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
const api: Express = express();
const router = Router();
const port = process.env.PORT || 3000;

// Static Files
api.use(express.static(__dirname + "/assets"));
api.use("/css", express.static(__dirname + "assets/css"));

// Set Templating Engine
api.set("views", __dirname + "/views");
api.set("view engine", "ejs");

router.get("/", (req: Request, res: Response) => {
  res.render("pages/home", {
    title: "Email Template Api",
    isHome: true,
  });
});

router.get("/template", (req: Request, res: Response) => {
  // Extract the template name fom query parameters
  const { template_name, first_name } = req.query;

  const requiredParams = ["template_name", "first_name", "last_name"];
  const missingParams = requiredParams.filter((param) => !req.query[param]);

  if (missingParams.length > 0) {
    return res.status(400).json({ error: "Missing parameters", missingParams });
  }

  res.render(`pages/${template_name}`, {
    title: "Thank you",
    isHome: false,
    displayName: first_name,
  });
});

api.use("/api/", router);

/* Start the Express app and listen for incoming requests on the specified port */
api.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
