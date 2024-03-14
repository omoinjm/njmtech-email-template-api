import IConfig from "../../src/interfaces/config";
import Development from "./development";
import Production from "./production";
import dotenv from "dotenv";

export default class ConfigService {
  constructor() {
    dotenv.config();
  }

  public current_config = (): IConfig => {
    switch (process.env.ENV) {
      case "production":
        return new Production();
      case "development":
        return new Development();
      default:
        throw new Error("Invalid value for Environment");
    }
  };
}
