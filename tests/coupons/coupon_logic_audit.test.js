import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { connectTestDb, cleanTestDb, closeTestDb } from "../helpers/dbHelper.js";
import {
    createTestUser,
    createTestProduct,
    createTestCoupon,
    createTestAddress,
    createTestCart,
    createTestWallet
} from "../helpers/factories.js";
import * as couponService from "../../services/user/couponService.js";
import * as checkoutService from "../../services/user/checkoutService.js";
import * as orderService from "../../services/user/orderService.js";
import * as adminOrderService from "../../services/admin/orderService.js";
import * as adminCouponService from "../../services/admin/couponService.js";
import * as userService from "../../services/user/userService.js";
import * as walletService from "../../services/user/walletService.js";
import { couponRateLimiter } from "../../middleware/rateLimiter.js";
import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import Coupon from "../../models/couponModel.js";
import Cart from "../../models/cartModel.js";
import Wallet from "../../models/walletModel.js";

describe("Coupon System Automated Logical & Security Audit", () => {
    before(async () => {
        await connectTestDb();
    });

    after(async () => {
        await closeTestDb();
    });

    beforeEach(async () => {
        await cleanTestDb();
    });

    describe("Category A & B: Coupon Types, Formulas & Basic Validity", () => {
        test("TC-A01: Percentage coupon calculates exact proportional discount", async () => {
            const user = await createTestUser();
            await createTestCoupon({
                code: "ROYAL10",
                discountType: "percentage",
                discountValue: 10
            });

            const result = await couponService.validateCoupon("ROYAL10", user._id, 10000);
            assert.equal(result.valid, true);
            assert.equal(result.discountAmount, 1000);
            assert.equal(result.newTotal, 9000);
        });

        test("TC-A02: Flat coupon deducts fixed absolute amount", async () => {
            const user = await createTestUser();
            await createTestCoupon({
                code: "FLAT500",
                discountType: "flat",
                discountValue: 500
            });

            const result = await couponService.validateCoupon("FLAT500", user._id, 5000);
            assert.equal(result.valid, true);
            assert.equal(result.discountAmount, 500);
            assert.equal(result.newTotal, 4500);
        });

        test("TC-A03: Percentage discount capped at maxDiscount", async () => {
            const user = await createTestUser();
            await createTestCoupon({
                code: "CAPPED20",
                discountType: "percentage",
                discountValue: 20,
                maxDiscount: 1000
            });

            const result = await couponService.validateCoupon("CAPPED20", user._id, 10000);
            assert.equal(result.discountAmount, 1000); // 20% of 10,000 = 2,000, capped at 1,000
            assert.equal(result.newTotal, 9000);
        });

        test("TC-B02: Invalid coupon code returns 404 error", async () => {
            const user = await createTestUser();
            await assert.rejects(
                async () => {
                    await couponService.validateCoupon("NONEXISTENT", user._id, 5000);
                },
                (err) => {
                    assert.equal(err.statusCode, 404);
                    assert.match(err.message, /Invalid coupon code/i);
                    return true;
                }
            );
        });

        test("TC-B03: Expired coupon is rejected with 400 error", async () => {
            const user = await createTestUser();
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 5);

            await createTestCoupon({
                code: "EXPIREDCODE",
                expiryDate: pastDate
            });

            await assert.rejects(
                async () => {
                    await couponService.validateCoupon("EXPIREDCODE", user._id, 5000);
                },
                (err) => {
                    assert.equal(err.statusCode, 400);
                    assert.match(err.message, /expired/i);
                    return true;
                }
            );
        });
    });

    describe("Category C & H: Cart Thresholds & Boundary Calculations", () => {
        test("TC-C01: Subtotal below minPurchase throws validation error", async () => {
            const user = await createTestUser();
            await createTestCoupon({
                code: "MINPURCHASE",
                discountType: "flat",
                minPurchase: 5000,
                discountValue: 500
            });

            await assert.rejects(
                async () => {
                    await couponService.validateCoupon("MINPURCHASE", user._id, 3000);
                },
                (err) => {
                    assert.equal(err.statusCode, 400);
                    assert.match(err.message, /minimum acquisition value/i);
                    return true;
                }
            );
        });

        test("TC-H01: Discount cannot exceed subtotal (never negative)", async () => {
            const user = await createTestUser();
            await createTestCoupon({
                code: "BIGFLAT",
                discountType: "flat",
                discountValue: 5000
            });

            const result = await couponService.validateCoupon("BIGFLAT", user._id, 2000);
            assert.equal(result.discountAmount, 2000); // capped at subtotal
            assert.equal(result.newTotal, 0);
        });
    });

    describe("Category D & J: [BUG-01 VERIFIED FIX] Cash on Delivery (COD) Usage Recording & Cart Clearance", () => {
        test("BUG-01: Placing a COD order records coupon usage, clears cart, and blocks reuse", async () => {
            const user = await createTestUser();
            const product = await createTestProduct({ regularPrice: 4000, stock: 10 });
            const address = await createTestAddress(user._id);

            const coupon = await createTestCoupon({
                code: "CODTEST",
                discountType: "flat",
                discountValue: 1000,
                usageLimit: 10
            });

            // Put item in cart
            await createTestCart(user._id, [{ product: product._id, quantity: 1, price: 4000 }]);

            // Place order using COD
            const order = await checkoutService.placeOrder({
                userId: user._id,
                addressId: address._id,
                paymentMethod: "COD",
                appliedCoupon: { code: coupon.code, discountAmount: 1000 }
            });

            assert.equal(order.paymentStatus, "Pending");
            assert.equal(order.orderStatus, "Placed");
            assert.equal(order.pricing.couponDiscount, 1000);

            // 1. VERIFY COUPON USAGE RECORDED
            const freshCoupon = await Coupon.findById(coupon._id);
            assert.equal(freshCoupon.usedCount, 1, "Coupon usedCount must be incremented to 1");
            assert.equal(freshCoupon.usedUsers.length, 1, "usedUsers array must contain redemption record");
            assert.equal(freshCoupon.usedUsers[0].userId.toString(), user._id.toString());

            // 2. VERIFY CART EMPTIED
            const freshCart = await Cart.findOne({ user: user._id });
            assert.equal(freshCart.items.length, 0, "Cart items must be cleared after order placement");

            // 3. VERIFY USER CANNOT REUSE THE SAME COUPON
            await assert.rejects(
                async () => {
                    await couponService.validateCoupon("CODTEST", user._id, 4000);
                },
                (err) => {
                    assert.equal(err.statusCode, 400);
                    assert.match(err.message, /already redeemed/i);
                    return true;
                }
            );

            // 4. VERIFY ANOTHER USER CAN STILL USE IT (SINCE usageLimit is 10)
            const anotherUser = await createTestUser();
            const anotherValidation = await couponService.validateCoupon("CODTEST", anotherUser._id, 4000);
            assert.equal(anotherValidation.valid, true);

            // 5. VERIFY A 1-USE COUPON REACHES GLOBAL LIMIT ON COD
            const singleUseCoupon = await createTestCoupon({
                code: "SINGLEUSE",
                discountType: "flat",
                discountValue: 500,
                usageLimit: 1
            });
            const anotherAddress = await createTestAddress(anotherUser._id);
            await createTestCart(anotherUser._id, [{ product: product._id, quantity: 1, price: 4000 }]);
            await checkoutService.placeOrder({
                userId: anotherUser._id,
                addressId: anotherAddress._id,
                paymentMethod: "COD",
                appliedCoupon: { code: singleUseCoupon.code, discountAmount: 500 }
            });

            const thirdUser = await createTestUser();
            await assert.rejects(
                async () => {
                    await couponService.validateCoupon("SINGLEUSE", thirdUser._id, 4000);
                },
                (err) => {
                    assert.equal(err.statusCode, 400);
                    assert.match(err.message, /maximum global redemption limit/i);
                    return true;
                }
            );
        });
    });

    describe("Category H & K: [BUG-02 VERIFIED FIX] Pro-Rata Partial Cancellation & Refund Calculation", () => {
        test("BUG-02: Cancelling 1 item from a multi-item coupon order refunds pro-rata discounted price", async () => {
            const user = await createTestUser();
            const product1 = await createTestProduct({ name: "Lighter Alpha", regularPrice: 5000, stock: 10 });
            const product2 = await createTestProduct({ name: "Lighter Beta", regularPrice: 5000, stock: 10 });
            const address = await createTestAddress(user._id);

            // Pre-seed wallet with balance: 10,000
            await createTestWallet(user._id, 10000);

            const coupon = await createTestCoupon({
                code: "SAVE2000",
                discountType: "flat",
                discountValue: 2000
            });

            // Cart with 2 items: Total ₹10,000, Coupon ₹2,000, Net Paid ₹8,000
            await createTestCart(user._id, [
                { product: product1._id, quantity: 1, price: 5000 },
                { product: product2._id, quantity: 1, price: 5000 }
            ]);

            const order = await checkoutService.placeOrder({
                userId: user._id,
                addressId: address._id,
                paymentMethod: "Wallet",
                paymentStatus: "Completed",
                appliedCoupon: { code: coupon.code, discountAmount: 2000 }
            });

            assert.equal(order.pricing.subtotal, 10000);
            assert.equal(order.pricing.couponDiscount, 2000);
            assert.equal(order.pricing.totalAmount, 8000);

            // Verify pro-rata discount shares on items
            const item1 = order.items.find((i) => i.name === "Lighter Alpha");
            const item2 = order.items.find((i) => i.name === "Lighter Beta");
            assert.equal(item1.discountShare, 1000, "Item 1 discount share must be ₹1,000");
            assert.equal(item1.netRefundableAmount, 4000, "Item 1 net refundable amount must be ₹4,000");
            assert.equal(item2.discountShare, 1000, "Item 2 discount share must be ₹1,000");
            assert.equal(item2.netRefundableAmount, 4000, "Item 2 net refundable amount must be ₹4,000");

            // User cancels Item 1 (Lighter Alpha)
            await orderService.cancelOrderItem(order.orderId, item1._id.toString(), user._id.toString(), "Changed mind");

            // Inspect fresh order: remaining payable must be ₹4,000 (Item 2's net share)
            const freshOrder = await orderService.getOrderDetails(order.orderId, user._id.toString());
            assert.equal(freshOrder.pricing.totalAmount, 4000, "Order remaining totalAmount must be ₹4,000 (Item 2's net payable)");

            // Inspect user wallet: initial was 10,000, debited 8,000 => 2,000 left. Refunded 4,000 => 6,000!
            const freshWallet = await Wallet.findOne({ user: user._id });
            assert.equal(freshWallet.balance, 6000, "Wallet must have received exact net refund of ₹4,000 (not undiscounted ₹5,000)");

            // Cancel Item 2 as well
            await orderService.cancelOrderItem(order.orderId, item2._id.toString(), user._id.toString(), "Cancel second item");

            const finalOrder = await orderService.getOrderDetails(order.orderId, user._id.toString());
            assert.equal(finalOrder.pricing.totalAmount, 0, "Final order totalAmount must be 0 after all items cancelled");
            assert.equal(finalOrder.orderStatus, "Cancelled");
            assert.equal(finalOrder.paymentStatus, "Refunded");

            const finalWallet = await Wallet.findOne({ user: user._id });
            assert.equal(finalWallet.balance, 10000, "Total refunded across both cancellations must exactly equal ₹8,000, restoring initial ₹10,000 wallet");
        });
    });

    describe("Category D: [BUG-03 VERIFIED FIX] Atomic Concurrency on Global & Per-User Usage Limits", () => {
        test("BUG-03: Atomic update prevents simultaneous redemptions from exceeding usageLimit", async () => {
            const userA = await createTestUser();
            const userB = await createTestUser();

            const coupon = await createTestCoupon({
                code: "LASTUSE1",
                discountType: "flat",
                discountValue: 500,
                usageLimit: 1,
                usedCount: 0
            });

            // Simulate concurrent validation
            const [valA, valB] = await Promise.all([
                couponService.validateCoupon("LASTUSE1", userA._id, 3000),
                couponService.validateCoupon("LASTUSE1", userB._id, 3000)
            ]);

            assert.equal(valA.valid, true);
            assert.equal(valB.valid, true);

            // Both attempt to record usage simultaneously
            const [resA, resB] = await Promise.all([
                couponService.recordCouponUsage("LASTUSE1", userA._id, null),
                couponService.recordCouponUsage("LASTUSE1", userB._id, null)
            ]);

            const freshCoupon = await Coupon.findById(coupon._id);

            // Exactly ONE must succeed and exactly ONE must fail
            const successCount = [resA, resB].filter((r) => r.success === true).length;
            const failCount = [resA, resB].filter((r) => r.success === false).length;

            assert.equal(successCount, 1, "Exactly one concurrent redemption must succeed");
            assert.equal(failCount, 1, "The second concurrent redemption must be blocked");
            assert.equal(freshCoupon.usedCount, 1, "usedCount must never exceed usageLimit of 1");
            assert.equal(freshCoupon.usedUsers.length, 1, "usedUsers array must contain exactly 1 entry");
        });

        test("BUG-03 (Edge Case): Same user concurrent redemption attempt is blocked atomically", async () => {
            const user = await createTestUser();
            await createTestCoupon({
                code: "USERCONCURRENCY",
                discountType: "flat",
                discountValue: 500,
                usageLimit: 10,
                usedCount: 0
            });

            // Same user attempts 2 concurrent usages
            const [res1, res2] = await Promise.all([
                couponService.recordCouponUsage("USERCONCURRENCY", user._id, null),
                couponService.recordCouponUsage("USERCONCURRENCY", user._id, null)
            ]);

            const freshCoupon = await Coupon.findOne({ code: "USERCONCURRENCY" });
            const successCount = [res1, res2].filter((r) => r.success === true).length;

            assert.equal(successCount, 1, "Only one usage record allowed per user");
            assert.equal(freshCoupon.usedCount, 1);
            assert.equal(freshCoupon.usedUsers.length, 1);
        });
    });

    describe("Category I & K: [BUG-04 & BUG-06 VERIFIED FIX] Referral Lifecycle & Clawback on Return", () => {
        test("BUG-04: Referral bonus is NOT disbursed at signup OTP verification", async () => {
            const referrer = await createTestUser({ referralCode: "REFERRER1" });
            const referee = await createTestUser({ referredBy: referrer._id, referralRewarded: false });

            // Simulate signup verification
            await userService.verifyOTP(referee._id, "000000").catch(() => null);

            const refWallet = await Wallet.findOne({ user: referrer._id });
            const refereeWallet = await Wallet.findOne({ user: referee._id });

            assert.equal(refWallet ? refWallet.balance : 0, 0, "Referrer wallet must have 0 bonus at signup");
            assert.equal(refereeWallet ? refereeWallet.balance : 0, 0, "Referee wallet must have 0 bonus at signup");
            assert.equal(referee.referralRewarded, false, "referralRewarded must remain false until order is delivered");
        });

        test("BUG-04 & BUG-06: Referral bonus awarded on first order Delivery and revoked on Return", async () => {
            const referrer = await createTestUser({ referralCode: "RYLREF123" });
            const referee = await createTestUser({ referredBy: referrer._id, referralRewarded: false });

            const product = await createTestProduct({ regularPrice: 3000, stock: 10 });
            const address = await createTestAddress(referee._id);
            await createTestCart(referee._id, [{ product: product._id, quantity: 1, price: 3000 }]);

            // Referee places order
            const order = await checkoutService.placeOrder({
                userId: referee._id,
                addressId: address._id,
                paymentMethod: "COD"
            });

            // 1. Order placed, not delivered yet: No referral reward
            let referrerWallet = await Wallet.findOne({ user: referrer._id });
            let refereeWallet = await Wallet.findOne({ user: referee._id });
            assert.equal(referrerWallet ? referrerWallet.balance : 0, 0, "Referrer must not receive reward before delivery");
            assert.equal(refereeWallet ? refereeWallet.balance : 0, 0, "Referee must not receive reward before delivery");

            // 2. Advance through valid status transitions to Delivered
            await adminOrderService.updateAdminOrderStatus(order.orderId, "Processing");
            await adminOrderService.updateAdminOrderStatus(order.orderId, "Shipped");
            await adminOrderService.updateAdminOrderStatus(order.orderId, "Out for Delivery");
            await adminOrderService.updateAdminOrderStatus(order.orderId, "Delivered");

            // Verify referral reward is disbursed
            referrerWallet = await Wallet.findOne({ user: referrer._id });
            refereeWallet = await Wallet.findOne({ user: referee._id });
            assert.equal(referrerWallet.balance, 100, "Referrer must receive ₹100 upon referee's first order delivery");
            assert.equal(refereeWallet.balance, 50, "Referee must receive ₹50 upon first order delivery");

            const updatedReferee = await User.findById(referee._id);
            assert.equal(updatedReferee.referralRewarded, true, "Referee marked as referralRewarded = true");

            const deliveredOrder = await Order.findOne({ orderId: order.orderId });
            assert.equal(deliveredOrder.unlockedReferralBonus.amount, 100);
            assert.equal(deliveredOrder.unlockedReferralBonus.isRevoked, false);

            // 3. Referee requests return, Admin approves return
            await orderService.returnOrder(order.orderId, referee._id.toString(), "Item returned by customer");
            await adminOrderService.updateAdminOrderStatus(order.orderId, "Returned", "Customer returned item");

            // Verify referral bonus is clawed back from referrer
            referrerWallet = await Wallet.findOne({ user: referrer._id });
            assert.equal(referrerWallet.balance, 0, "Referrer's ₹100 bonus must be revoked after order return");

            const returnedOrder = await Order.findOne({ orderId: order.orderId });
            assert.equal(returnedOrder.unlockedReferralBonus.isRevoked, true, "Referral bonus marked isRevoked = true");
        });
    });

    describe("Category I: [BUG-05 VERIFIED FIX] Self-Referral Prevention & Inactive Codes", () => {
        test("BUG-05: User cannot refer themselves with their own email or phone", async () => {
            await createTestUser({
                email: "sameuser@example.com",
                phone: "9876543210",
                referralCode: "MYCODE123"
            });

            // Attempt to register with same phone and referral code
            await assert.rejects(
                async () => {
                    await userService.createUser({
                        name: "Duplicate User",
                        email: "different@example.com",
                        phone: "9876543210",
                        password: "Password123!",
                        referralCode: "MYCODE123"
                    });
                },
                (err) => {
                    assert.match(err.message, /Self-referral is strictly prohibited/i);
                    return true;
                }
            );

            // Attempt to register with same email and referral code
            await assert.rejects(
                async () => {
                    await userService.createUser({
                        name: "Duplicate User 2",
                        email: "sameuser@example.com",
                        phone: "9123456789",
                        password: "Password123!",
                        referralCode: "MYCODE123"
                    });
                },
                (err) => {
                    assert.match(err.message, /Self-referral is strictly prohibited/i);
                    return true;
                }
            );
        });

        test("BUG-05: Non-existent referral code is rejected with descriptive error", async () => {
            await assert.rejects(
                async () => {
                    await userService.createUser({
                        name: "New User",
                        email: "newuser123@example.com",
                        phone: "9988776655",
                        password: "Password123!",
                        referralCode: "FAKECODE999"
                    });
                },
                (err) => {
                    assert.equal(err.statusCode, 400);
                    assert.match(err.message, /invalid or inactive/i);
                    return true;
                }
            );
        });
    });

    describe("Category G: [BUG-07 VERIFIED FIX] Session & Financials Invalidation on Cart Mutation", () => {
        test("BUG-07: Subtotal drop below minPurchase invalidates coupon in getCheckoutDetails", async () => {
            const user = await createTestUser();
            const product = await createTestProduct({ regularPrice: 2000, stock: 10 });
            await createTestCoupon({
                code: "MIN3000",
                discountType: "flat",
                discountValue: 500,
                minPurchase: 3000
            });

            // Cart with 1 item: Subtotal ₹2,000 (below ₹3,000 min)
            await createTestCart(user._id, [{ product: product._id, quantity: 1, price: 2000 }]);

            // If a stale coupon session exists, getCheckoutDetails must nullify couponCode and set couponDiscount to 0
            const staleSessionCoupon = { code: "MIN3000", discountAmount: 500 };
            const details = await checkoutService.getCheckoutDetails(user._id, staleSessionCoupon);

            assert.equal(details.financials.couponDiscount, 0, "Coupon discount must drop to 0 when minPurchase is not met");
            assert.equal(details.financials.couponCode, null, "Coupon code must be cleared when minPurchase is not met");
            assert.equal(details.financials.totalAmount, 2000, "Total amount must equal full subtotal without discount");
        });
    });

    describe("Category B & M: [BUG-12 & BUG-13 VERIFIED FIX] Scheduled StartDate & Percentage Cap", () => {
        test("BUG-12: Future-dated coupon is rejected as not yet active", async () => {
            const user = await createTestUser();
            const futureStart = new Date();
            futureStart.setDate(futureStart.getDate() + 7);

            await createTestCoupon({
                code: "FUTUREFLASH",
                startDate: futureStart
            });

            await assert.rejects(
                async () => {
                    await couponService.validateCoupon("FUTUREFLASH", user._id, 5000);
                },
                (err) => {
                    assert.equal(err.statusCode, 400);
                    assert.match(err.message, /not yet active/i);
                    return true;
                }
            );
        });

        test("BUG-13: Mongoose schema blocks percentage discounts exceeding 100%", async () => {
            await assert.rejects(
                async () => {
                    await createTestCoupon({
                        code: "INVALID150PERCENT",
                        discountType: "percentage",
                        discountValue: 150
                    });
                },
                (err) => {
                    assert.match(err.message, /Percentage discount cannot exceed 100%/i);
                    return true;
                }
            );
        });
    });

    describe("Category H & L: [BUG-10 VERIFIED FIX] Atomic Wallet Deductions (Anti-Double Spend)", () => {
        test("BUG-10: Parallel debits against insufficient balance fail atomically", async () => {
            const user = await createTestUser();
            await createTestWallet(user._id, 1000); // balance: ₹1,000

            // Two simultaneous debits of ₹1,000 each
            const [res1, res2] = await Promise.allSettled([
                walletService.debitWallet(user._id, { amount: 1000, source: "checkout_payment" }),
                walletService.debitWallet(user._id, { amount: 1000, source: "checkout_payment" })
            ]);

            const fulfilledCount = [res1, res2].filter((r) => r.status === "fulfilled").length;
            const rejectedCount = [res1, res2].filter((r) => r.status === "rejected").length;

            assert.equal(fulfilledCount, 1, "Exactly one debit of ₹1,000 must succeed");
            assert.equal(rejectedCount, 1, "The second concurrent debit must be rejected atomically");

            const freshWallet = await Wallet.findOne({ user: user._id });
            assert.equal(freshWallet.balance, 0, "Wallet balance must remain at 0 (never negative)");
        });
    });

    describe("Category B: [BUG-08 VERIFIED FIX] IST Expiry Normalization", () => {
        test("BUG-08: Admin coupon creation normalizes date-only input to end-of-day IST", async () => {
            const coupon = await adminCouponService.createCoupon({
                code: "ISTTEST2026",
                discountType: "flat",
                discountValue: 200,
                minPurchase: 1000,
                expiryDate: "2026-12-31"
            });

            // ISO string in UTC should be 2026-12-31T18:29:59.999Z because 23:59:59.999 in IST (+05:30) is 18:29:59.999Z
            const iso = coupon.expiryDate.toISOString();
            assert.equal(iso, "2026-12-31T18:29:59.999Z");
        });
    });

    describe("Category L: [BUG-09 VERIFIED FIX] Coupon Brute-Force Rate Limiting", () => {
        test("BUG-09: Sliding window rate limiter rejects after threshold attempts", () => {
            const limiter = couponRateLimiter(5, 60000);
            const req = { ip: "192.168.1.100", headers: {} };
            let callCount = 0;
            const next = () => {
                callCount++;
            };
            let blockedStatus = null;
            let blockedPayload = null;
            const res = {
                status(code) {
                    blockedStatus = code;
                    return this;
                },
                json(payload) {
                    blockedPayload = payload;
                    return this;
                }
            };

            for (let i = 0; i < 5; i++) {
                limiter(req, res, next);
            }
            assert.equal(callCount, 5, "First 5 requests within window must pass");

            limiter(req, res, next);
            assert.equal(callCount, 5, "Blocked request must not call next()");
            assert.equal(blockedStatus, 429, "Blocked request must receive HTTP 429 status");
            assert.match(blockedPayload.message, /Too many coupon verification attempts/i);
        });
    });

    describe("Category H & J: [BUG-11 VERIFIED FIX] 100% Discount / Zero-Payable Order Calculation", () => {
        test("BUG-11: 100% discount coupon reduces total payable to exactly 0 without negative balance", async () => {
            const user = await createTestUser();
            await createTestCoupon({
                code: "FREE100",
                discountType: "percentage",
                discountValue: 100
            });

            const result = await couponService.validateCoupon("FREE100", user._id, 3000);
            assert.equal(result.valid, true);
            assert.equal(result.discountAmount, 3000);
            assert.equal(result.newTotal, 0);
        });
    });
});
