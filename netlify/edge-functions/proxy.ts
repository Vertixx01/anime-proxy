import { handle } from "hono/netlify";
import { app } from "../../src/index";

export default handle(app);
