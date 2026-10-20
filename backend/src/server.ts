import { createApp } from "./app";

const portValue = process.env.PORT ?? "3765";
const port = Number(portValue);
const app = createApp();

if (
  !/^\d+$/.test(portValue) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65_535
) {
  throw new Error("PORT must be a valid TCP port");
}

app.listen(port, "127.0.0.1", () => {
  process.stdout.write(`V-Vault backend listening on 127.0.0.1:${port}\n`);
});
