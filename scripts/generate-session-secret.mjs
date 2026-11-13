import { randomBytes } from "node:crypto";

process.stdout.write(`ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64url")}\n`);
