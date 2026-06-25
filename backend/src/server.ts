import "dotenv/config";

import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.info(`YsabelleStore backend foundation listening on port ${env.PORT}`);
});
