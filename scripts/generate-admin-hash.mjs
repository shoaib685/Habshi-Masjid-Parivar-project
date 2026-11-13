import { randomBytes, scryptSync } from "node:crypto";
import { emitKeypressEvents } from "node:readline";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("Run this command in an interactive terminal so the password is not echoed.");
  process.exitCode = 1;
} else {
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write("Admin password (minimum 12 characters; input is hidden): ");

  let password = "";
  const finish = () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeAllListeners("keypress");
  };

  process.stdin.on("keypress", (character, key) => {
    if (key?.ctrl && key.name === "c") {
      finish();
      process.stdout.write("\nCancelled.\n");
      process.exitCode = 1;
      return;
    }

    if (key?.name === "return") {
      finish();
      process.stdout.write("\n");
      if (password.length < 12) {
        console.error("Password must be at least 12 characters.");
        process.exitCode = 1;
        return;
      }

      const salt = randomBytes(16);
      const hash = scryptSync(password, salt, 64);
      process.stdout.write(
        `ADMIN_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${hash.toString("hex")}\n`,
      );
      password = "";
      return;
    }

    if (key?.name === "backspace") {
      password = password.slice(0, -1);
      return;
    }
    if (!key?.ctrl && character) password += character;
  });
}
