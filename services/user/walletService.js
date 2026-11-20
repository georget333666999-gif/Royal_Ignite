import Wallet from "../../models/walletModel.js";

/**
 * Get or initialize user wallet
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export const getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
        wallet = await Wallet.create({
            user: userId,
            balance: 0,
            transactions: []
        });
    }
    return wallet;
};

/**
 * Credit amount to user wallet
 * @param {string} userId
 * @param {Object} options
 * @param {number} options.amount
 * @param {string} options.description
 * @param {string} options.source
 * @param {string} [options.orderId]
 * @returns {Promise<Object>}
 */
export const creditWallet = async (userId, { amount, description, source, orderId = null }) => {
    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Credit amount must be greater than zero.");
    }

    const wallet = await getOrCreateWallet(userId);
    const newBalance = Math.round((wallet.balance + parsedAmount) * 100) / 100;

    const newTx = {
        type: "credit",
        amount: parsedAmount,
        balanceAfter: newBalance,
        description: description || "Refund credited to wallet",
        source,
        orderId,
        date: new Date()
    };

    wallet.transactions.push(newTx);
    wallet.balance = newBalance;
    await wallet.save();

    const createdTx = wallet.transactions[wallet.transactions.length - 1];

    return {
        success: true,
        balance: newBalance,
        transaction: createdTx
    };
};

/**
 * Debit amount from user wallet
 * @param {string} userId
 * @param {Object} options
 * @param {number} options.amount
 * @param {string} options.description
 * @param {string} options.source
 * @param {string} [options.orderId]
 * @returns {Promise<Object>}
 */
export const debitWallet = async (userId, { amount, description, source, orderId = null }) => {
    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Debit amount must be greater than zero.");
    }

    await getOrCreateWallet(userId);

    const newTx = {
        type: "debit",
        amount: parsedAmount,
        description: description || "Payment debited from wallet",
        source,
        orderId,
        date: new Date()
    };

    // Atomic conditional debit: balance must be >= parsedAmount
    const updatedWallet = await Wallet.findOneAndUpdate(
        { user: userId, balance: { $gte: parsedAmount } },
        {
            $inc: { balance: -parsedAmount },
            $push: { transactions: newTx }
        },
        { returnDocument: "after" }
    );

    if (!updatedWallet) {
        const currentWallet = await Wallet.findOne({ user: userId });
        const avail = currentWallet ? currentWallet.balance : 0;
        const err = new Error(
            `Insufficient wallet balance. Available: ₹${avail.toLocaleString("en-IN")}, Required: ₹${parsedAmount.toLocaleString("en-IN")}`
        );
        err.code = "INSUFFICIENT_WALLET_BALANCE";
        throw err;
    }

    // Set balanceAfter on latest transaction
    const latestTx = updatedWallet.transactions[updatedWallet.transactions.length - 1];
    if (latestTx) {
        latestTx.balanceAfter = updatedWallet.balance;
        await Wallet.updateOne(
            { _id: updatedWallet._id, "transactions._id": latestTx._id },
            { $set: { "transactions.$.balanceAfter": updatedWallet.balance } }
        );
    }

    return {
        success: true,
        balance: updatedWallet.balance,
        transaction: latestTx || newTx
    };
};

/**
 * Fetch wallet summary & paginated transactions
 * @param {string} userId
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object>}
 */
export const getWalletDetails = async (userId, { page = 1, limit = 10 } = {}) => {
    const wallet = await getOrCreateWallet(userId);

    // Sort transactions descending (latest first)
    const sortedTx = [...wallet.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalTx = sortedTx.length;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 10);
    const totalPages = Math.ceil(totalTx / pageSize) || 1;
    const skip = (currentPage - 1) * pageSize;
    const paginatedTx = sortedTx.slice(skip, skip + pageSize);

    const totalCredited = sortedTx
        .filter((t) => t.type === "credit")
        .reduce((sum, t) => sum + t.amount, 0);

    const totalDebited = sortedTx
        .filter((t) => t.type === "debit")
        .reduce((sum, t) => sum + t.amount, 0);

    return {
        balance: wallet.balance,
        transactions: paginatedTx,
        totalTransactions: totalTx,
        currentPage,
        totalPages,
        limit: pageSize,
        totalCredited,
        totalDebited
    };
};

export default {
    getOrCreateWallet,
    creditWallet,
    debitWallet,
    getWalletDetails
};

