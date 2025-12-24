import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env") });
const config = {
  port: process.env.PORT,
  connectionString: process.env.CONNECTION_STRING,
};

export default config;
