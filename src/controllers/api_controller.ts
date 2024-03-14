import express, { Express, Router } from "express";
import IConfig from "../../src/interfaces/config";
import ConfigService from "../../src/config";

export default class ApiController {
  private app: Express;
  public router: Router;
  public config: IConfig;

  constructor() {
    /*
     * Create an Express application and get the
     * value of the PORT environment variable
     * from the `process.env`
     */

    this.app = express();
    this.router = Router();

    this.config = new ConfigService().current_config();
  }
}
