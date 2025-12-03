const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); // opsional, security headers
const cookieParser = require("cookie-parser");

const routes = require("./routes"); // autoloader
const errorHandler = require("./middleware/errorHandler"); // error handler

const app = express();

// Security headers
app.use(helmet());

// CORS (tune origin in production)
app.use(cors({ origin: true }));

// Parsers
app.use(express.json()); // pakai built-in parser
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Basic health endpoints untuk load balancer
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", (_req, res) => res.status(200).json({ ready: true }));

// buat API routes dengan /api
app.use("/api", routes);

// 404 fallback
app.use((req, res) => res.status(404).json({ message: "Not Found" }));

// error handler (last middleware)
app.use(errorHandler);

module.exports = app;
