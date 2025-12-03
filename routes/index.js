const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const routesDir = path.join(__dirname, "..", "routes");

router.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

fs.readdirSync(routesDir).forEach((file) => {
  const full = path.join(routesDir, file);
  if (!fs.statSync(full).isFile()) return;
  if (!file.endsWith(".js")) return;
  if (file === "index.js") return;

  const routeModule = require(full);
  // derive mount path: remove 'Route' or 'Routes' suffix, remove extension, toLowerCase
  const mount =
    "/" +
    file
      .replace(/Route\.js$/i, "")
      .replace(/Routes\.js$/i, "")
      .replace(/\.js$/i, "")
      .toLowerCase();

  router.use(mount, routeModule);
});

module.exports = router;
