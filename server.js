import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// ✅ Allow frontend origin
app.use(cors({ origin: "http://localhost:8080", methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ------------------ CREATE ORDER ------------------
app.post("/api/razorpay-order", async (req, res) => {
  try {
    const { amount, planName } = req.body;

    if (!amount) return res.status(400).json({ success: false, error: "Amount is required" });
    if (!planName) return res.status(400).json({ success: false, error: "Plan name is required" });

    const options = {
      amount: amount, // paise me bhejna hota hai (frontend already multiplies by 100)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { purpose: "PlanPurchase" },
      description: `Plan-${planName.replace(/[^a-zA-Z0-9_]/g, "")}`,
    };

    const order = await razorpay.orders.create(options);
    console.log("✅ Order Created:", order);
    res.json({ success: true, order });
  } catch (error) {
    console.error("❌ Error creating Razorpay order:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------ VERIFY PAYMENT ------------------
app.post("/api/razorpay-verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userName,
      userEmail,
      userMobile,
      planName,
      amount,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: "Missing Razorpay fields" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      console.log("✅ Payment Verified:", {
        userName,
        userEmail,
        userMobile,
        planName,
        amount,
        razorpay_order_id,
        razorpay_payment_id,
      });
      return res.json({ success: true, message: "Payment verified" });
    } else {
      console.warn("❌ Signature mismatch");
      return res.status(400).json({ success: false, error: "Invalid signature" });
    }
  } catch (err) {
    console.error("❌ Verification Error:", err.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5001;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

export default app;
