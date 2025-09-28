import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();

// --- CORS Configuration (Good practice for Express) ---
app.use((req, res, next) => {
    // Note: The vercel.json file also sets this, but it's good practice
    // to include it here for robustness.
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// ------------------ CONFIG (GET FROM VERCEL ENVIRONMENT VARIABLES) ------------------
// IMPORTANT: Ensure these are set in your Vercel project settings
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX;
const BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox"; // Use production URL when ready

// ------------------ CHECKSUM FUNCTION ------------------
function generateChecksum(payload, apiEndpoint) {
  // 1. Base64 encode the JSON payload
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  
  // 2. Concatenate the string to be signed
  const stringToSign = base64Payload + apiEndpoint + SALT_KEY;
  
  // 3. Generate SHA256 hash
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  
  // 4. Append the salt index
  return { base64Payload, checksum: sha256 + "###" + SALT_INDEX };
}

// ------------------ PAYMENT INITIATION ------------------
app.post("/api/pay", async (req, res) => {
  try {
    const { amount, userId, mobile, planName } = req.body;

    // 1. --- CRITICAL SERVER CONFIGURATION CHECK (LIKELY CAUSE OF 500 ERROR) ---
    if (!MERCHANT_ID || !SALT_KEY || !SALT_INDEX) {
        console.error("Payment Proxy Error: PHONEPE_MERCHANT_ID, SALT_KEY, or SALT_INDEX is missing from environment variables.");
        return res.status(500).json({ error: "Server configuration is incomplete. Please contact support." });
    }

    // 2. --- INPUT VALIDATION CHECK ---
    if (!amount || !userId || !mobile) {
        console.error("Payment Proxy Error: Missing required fields in request body:", req.body);
        return res.status(400).json({ error: "Missing required details: amount, userId, or mobile." });
    }
    
    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: "txn_" + Date.now(), // Unique ID for this transaction
      merchantUserId: userId,
      amount: amount * 100, // Amount MUST be in paise (e.g., ₹100 is 10000 paise)
      redirectUrl: "https://shark-pay-eight.vercel.app/api/callback", 
      redirectMode: "POST",
      callbackUrl: "https://shark-pay-eight.vercel.app/api/callback", // For server-to-server status update
      mobileNumber: mobile, // Use the actual mobile number passed from the frontend
      paymentInstrument: { 
        type: "PAY_PAGE" 
      },
      // Optionally add more context for tracking
      metadata: {
        plan: planName || 'Unknown Plan',
        appId: 'SharkGlow'
      }
    };

    const endpoint = "/pg/v1/pay";
    const { base64Payload, checksum } = generateChecksum(payload, endpoint);

    console.log(`Initiating payment for ${payload.amount / 100} to ${payload.merchantTransactionId}`);
    
    // 3. --- AXIOS CALL TO PHONEPE API ---
    const response = await axios.post(
      `${BASE_URL}${endpoint}`,
      { request: base64Payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum, // The calculated security checksum
          "X-MERCHANT-ID": MERCHANT_ID,
        },
      }
    );

    // Send the PhonePe response back to the frontend for redirection
    res.json(response.data);
  } catch (err) {
    // Log detailed error from PhonePe or Axios
    console.error("Payment Initiation Failed:", err.response?.data || err.message);
    
    // Return a generic 500 error to the frontend
    res.status(500).json({ error: "Payment initiation failed at the server level. Check server logs." });
  }
});

// ------------------ PAYMENT CALLBACK ------------------
// This endpoint is hit by PhonePe's server after a payment attempt (success/failure)
app.post("/api/callback", (req, res) => {
  // The actual transaction status is found inside req.body.response or req.body.
  // CRITICAL: Always verify the checksum (X-VERIFY) of the callback data before processing!

  console.log("PhonePe Callback received. Processing transaction status...");

  // In a real application, you would:
  // 1. Get X-VERIFY header and calculate checksum locally.
  // 2. If checksum matches, process the payment status (SUCCESS/FAILURE).
  // 3. Update the order status in your database.

  // PhonePe requires a 200 OK response quickly to confirm the callback was received.
  res.json({ success: true, message: "Callback received and processed." });
});

// ------------------ VERCEL SERVERLESS EXPORT ------------------
// Export the Express app for Vercel to use.
module.exports = app;

// The previous app.listen(5000, ...) is removed as it is incompatible with Vercel.
