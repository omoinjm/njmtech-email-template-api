import dotenv from "dotenv";
import IConfig from "../../src/interfaces/config";

export default class Production implements IConfig {
  constructor() {
    /*
     * Load up and parse configuration details from
     * the `.env` file to the `process.env`
     * object of Node.js
     */
    dotenv.config();
  }

  public getPort = (): string => {
    return process.env.PORT;
  };

  public getEnv = (): string => {
    return "production";
  };
}
