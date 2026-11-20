import mongoose from "mongoose";

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/royal_ignite_coupon_test";

/**
 * Connect to isolated local test database
 */
export const connectTestDb = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }
    await mongoose.connect(TEST_DB_URI, {
        serverSelectionTimeoutMS: 5000
    });
    return mongoose.connection;
};

/**
 * Drop all test collections to ensure pure isolation between test suites
 */
export const cleanTestDb = async () => {
    if (mongoose.connection.readyState !== 1) return;
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
};

/**
 * Disconnect and drop test database
 */
export const closeTestDb = async () => {
    if (mongoose.connection.readyState !== 0) {
        if (mongoose.connection.db) {
            await mongoose.connection.db.dropDatabase();
        }
        await mongoose.disconnect();
    }
};
