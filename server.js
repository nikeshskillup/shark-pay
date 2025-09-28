import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();

// We keep the application clean. CORS headers will be applied by vercel.json.
app.use(express.json());

// ------------------ CONFIG ------------------
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX;
const BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox"; 

// ------------------ CHECKSUM FUNCTION ------------------
function generateChecksum(payload, apiEndpoint) {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const stringToSign = base64Payload + apiEndpoint + SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  return { base64Payload, checksum: sha256 + "###" + SALT_INDEX };
}

// ------------------ PAYMENT INITIATION ------------------
app.post("/api/pay", async (req, res) => {
  try {
    const { amount, userId, mobile, planName } = req.body;

    // Environment variable check (already confirmed working, but kept for safety)
    if (!MERCHANT_ID || !SALT_KEY || !SALT_INDEX) {
        return res.status(500).json({ error: "Server configuration is incomplete." });
    }

    if (!amount || !userId || !mobile) {
        return res.status(400).json({ error: "Missing required details." });
    }
    
    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: "txn_" + Date.now(),
      merchantUserId: userId,
      amount: amount * 100, // Amount in paise
      redirectUrl: "https://shark-pay-eight.vercel.app/api/callback", 
      redirectMode: "POST",
      callbackUrl: "https://shark-pay-eight.vercel.app/api/callback", 
      mobileNumber: mobile,
      paymentInstrument: { 
        type: "PAY_PAGE" 
      },
    };

    const endpoint = "/pg/v1/pay";
    const { base64Payload, checksum } = generateChecksum(payload, endpoint);

    const response = await axios.post(
      `${BASE_URL}${endpoint}`,
      { request: base64Payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
          "X-MERCHANT-ID": MERCHANT_ID,
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error("Payment Initiation Failed:", err.response?.data || err.message);
    res.status(500).json({ error: "Payment initiation failed at the server level. Check server logs." });
  }
});

// ------------------ PAYMENT CALLBACK ------------------
app.post("/api/callback", (req, res) => {
  res.json({ success: true, message: "Callback received and processed." });
});

// ------------------ VERCEL SERVERLESS EXPORT ------------------
module.exports = app;
