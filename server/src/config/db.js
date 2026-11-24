const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing from the environment.");
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });

    console.log(`MongoDB Connected: ${connection.connection.host}`);

    return connection;
  } catch (error) {
    console.error("[MongoDB Connection Failed]", error.message);

    // Let app.js handle startup failure.
    throw error;
  }
};

module.exports = connectDB;
