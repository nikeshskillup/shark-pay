import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.use(express.json());

// ------------------ CONFIG ------------------
const MERCHANT_ID = "YOUR_MERCHANT_ID";  // from PhonePe dashboard
const SALT_KEY = "YOUR_SALT_KEY";        // from PhonePe dashboard
const SALT_INDEX = "YOUR_SALT_INDEX";    // from PhonePe dashboard
const BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox"; // use sandbox first

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
    const { amount, userId } = req.body;

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: "txn_" + Date.now(),
      merchantUserId: userId || "guest_user",
      amount: amount * 100, // paise
      redirectUrl: "http://localhost:5000/api/callback", // after payment, PhonePe redirects here
      redirectMode: "POST",
      callbackUrl: "http://localhost:5000/api/callback",
      mobileNumber: "9999999999", // optional
      paymentInstrument: { type: "PAY_PAGE" },
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
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Payment initiation failed" });
  }
});

// ------------------ PAYMENT CALLBACK ------------------
app.post("/api/callback", (req, res) => {
  console.log("Callback received:", req.body);

  // PhonePe sends payment status in req.body
  // You should verify checksum again (for security) and then update order status in DB

  // Example response to PhonePe (must return 200 OK quickly)
  res.json({ success: true });
});

// ------------------ START SERVER ------------------
app.listen(5000, () => console.log("Server running on http://localhost:5000"));
