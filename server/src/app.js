const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const ipoRoutes = require("./routes/ipoRoutes");
const { initCronJobs } = require("./jobs/cronScheduler");

dotenv.config();

// Connect to MongoDB
connectDB();

// Start cron scheduler
initCronJobs();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/ipos", ipoRoutes);

// Health Check Endpoint
app.get("/", (req, res) => {
  res.send("ListingLogic API Service is running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});
