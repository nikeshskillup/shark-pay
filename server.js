import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// Replace with your PhonePe credentials
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const BASE_URL = "https://api.phonepe.com/apis/hermes"; // UAT: https://api-preprod.phonepe.com/apis/hermes

// Create Payment Order
app.post("/api/pay", async (req, res) => {
  try {
    const { amount, mobile, transactionId } = req.body;

    const payload = {
      merchantId: MERCHANT_ID,
      transactionId: transactionId,
      amount: amount * 100, // in paise
      merchantUserId: "USER123",
      redirectUrl: "http://localhost:3000/success", // Change to your frontend URL
      redirectMode: "POST",
      callbackUrl: "https://your-vercel-server.vercel.app/api/callback",
      mobileNumber: mobile,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    // Send to PhonePe API
    const response = await axios.post(`${BASE_URL}/pg/v1/pay`, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": SALT_KEY,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Payment initiation failed" });
  }
});

// Payment Callback (PhonePe → Your backend)
app.post("/api/callback", (req, res) => {
  console.log("Callback from PhonePe:", req.body);
  // Update DB / send status to frontend
  res.sendStatus(200);
});

// Health check
app.get("/", (req, res) => {
  res.send("PhonePe backend is running 🚀");
});

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
