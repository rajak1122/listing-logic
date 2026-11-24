const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const ipoRoutes = require("./routes/ipoRoutes");
const adminRoutes = require("./routes/adminRoutes");

const { initCronJobs, stopCronJobs } = require("./jobs/cronScheduler");

const app = express();

const PORT = process.env.PORT || 5000;

// ==========================================
// CORS CONFIGURATION
// ==========================================

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as server-to-server
      // requests and local terminal testing.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin is not allowed."));
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],

    maxAge: 86400,
  }),
);

app.use(express.json({ limit: "1mb" }));

// ==========================================
// API ROUTES
// ==========================================

app.use("/api/ipos", ipoRoutes);
app.use("/api/admins", adminRoutes);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    service: "ListingLogic API",
    database: databaseConnected ? "connected" : "disconnected",
    environment: process.env.NODE_ENV || "development",
  });
});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
  if (error.message === "CORS origin is not allowed.") {
    return res.status(403).json({
      success: false,
      message: "This origin is not allowed.",
    });
  }

  console.error("[Unhandled API Error]", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================

let httpServer = null;

const startServer = async () => {
  // 1. Wait until MongoDB is connected.
  await connectDB();

  // 2. Start cron only after database is ready.
  initCronJobs();

  // 3. Start accepting HTTP requests.
  httpServer = await new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(
        `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );

      resolve(server);
    });

    server.once("error", reject);
  });

  return httpServer;
};

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

const stopServer = async () => {
  stopCronJobs();

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });

    httpServer = null;
  }

  await mongoose.disconnect();

  console.log("ListingLogic API shut down cleanly.");
};

// Run the server only when this file is executed directly.
if (require.main === module) {
  startServer().catch((error) => {
    console.error("[Server Startup Failed]", error.message);
    process.exitCode = 1;
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down...`);

    try {
      await stopServer();
    } catch (error) {
      console.error("[Shutdown Error]", error.message);
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = {
  app,
  startServer,
  stopServer,
};
