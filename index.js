const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const axios = require('axios');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// For beginner simplicity: hardcoded admin credentials (change later!)
const ADMIN_EMAIL = 'admin@turf.com';
const ADMIN_PASSWORD = 'admin123'; // ← Change this to something strong later

// Booking Schema & Model
const bookingSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  mobile: { type: String, required: true },
  dateTime: { type: String, required: true },
  turfSlot: { type: String, required: true },
  duration: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);

// ────────────────────────────────────────────────
// Route 1: Admin Login (simple JWT token)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ email }, 'mySuperSecretKey123', { expiresIn: '1h' });
    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false, message: 'Invalid email or password' });
});

// ────────────────────────────────────────────────
// Route 2: Get all bookings (for dashboard list)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

// ────────────────────────────────────────────────
// Route 3: Create new booking + send WhatsApp message
app.post('/api/bookings', async (req, res) => {
  try {
    const { customerName, mobile, dateTime, turfSlot, duration } = req.body;

    // Save to database
    const newBooking = new Booking({
      customerName,
      mobile,
      dateTime,
      turfSlot,
      duration
    });
    await newBooking.save();

    // Try to send WhatsApp confirmation (will work after we set up .env)
    try {
      await sendWhatsAppMessage(customerName, mobile, dateTime, turfSlot);
      res.json({ success: true, message: 'Booking confirmed & WhatsApp sent!' });
    } catch (whatsappErr) {
      console.error('WhatsApp send failed:', whatsappErr);
      res.json({ success: true, message: 'Booking saved (WhatsApp message failed)' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error saving booking' });
  }
});

// Simple WhatsApp function (using Meta Cloud API)
async function sendWhatsAppMessage(name, mobile, dateTime, slot) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp credentials missing in .env');
  }

  const message = `Hello ${name}, your turf booking is confirmed for ${dateTime}. Turf Slot: ${slot}. Thank you!`;

  await axios.post(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: mobile,                    // must be full number like 919876543210 (no + or 00)
      type: 'text',
      text: { body: message }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
}

// ────────────────────────────────────────────────
// Route 4: Delete a booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting booking' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});