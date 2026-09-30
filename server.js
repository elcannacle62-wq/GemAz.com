const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;
const SITE_URL = process.env.SITE_URL || "";
const EPOINT_PUBLIC_KEY = process.env.EPOINT_PUBLIC_KEY || "";
const EPOINT_PRIVATE_KEY = process.env.EPOINT_PRIVATE_KEY || "";

app.use(express.static(__dirname));

function makeSignature(data) {
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64");
  const signature = crypto
    .createHash("sha1")
    .update(EPOINT_PRIVATE_KEY + encoded + EPOINT_PRIVATE_KEY)
    .digest("base64");

  return {
    data: encoded,
    signature
  };
}

app.post("/api/create-payment", async (req, res) => {
  try {
    const { amount, orderId, phone } = req.body;

    if (!amount || !orderId) {
      return res.status(400).json({
        ok: false,
        error: "amount və orderId tələb olunur"
      });
    }

    if (!EPOINT_PUBLIC_KEY || !EPOINT_PRIVATE_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Epoint açarları serverdə əlavə edilməyib"
      });
    }

    const paymentData = {
      public_key: EPOINT_PUBLIC_KEY,
      amount: Number(amount).toFixed(2),
      currency: "AZN",
      language: "az",
      order_id: String(orderId),
      description: `GemAZ sifariş ${orderId}`,
      success_redirect_url: `${SITE_URL}/payment-success.html`,
      error_redirect_url: `${SITE_URL}/payment-error.html`,
      callback_url: `${SITE_URL}/api/epoint/result`,
      phone: phone || ""
    };

    const signed = makeSignature(paymentData);

    const response = await fetch("https://epoint.az/api/1/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(signed)
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Epoint server xətası",
        details: result
      });
    }

    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: "Ödəniş yaradılarkən server xətası"
    });
  }
});

app.post("/api/epoint/result", (req, res) => {
  console.log("Epoint callback:", req.body);
  res.status(200).send("OK");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "GemAZ payment server"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GemAZ server running on port ${PORT}`);
});
