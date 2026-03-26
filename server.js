const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route (important for Railway)
app.get('/', (req, res) => {
  res.send("Turf Booking API is running 🚀");
});

// API test route
app.get('/api', (req, res) => {
  res.json({ message: "API working successfully" });
});

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// ================= USER MODEL =================

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', UserSchema);

// ================= LOGIN ROUTE =================

app.post('/api/auth/login', async (req, res) => {
  try {

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= BOOKING MODEL =================

const BookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  slot: { type: String, required: true },
  hours: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  paymentId: { type: String },
});

const Booking = mongoose.model('Booking', BookingSchema);

// ================= AUTH MIDDLEWARE =================

const authMiddleware = (req, res, next) => {

  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.id;

    next();

  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// ================= BOOKING ROUTE =================

app.post('/api/bookings', authMiddleware, async (req, res) => {

  try {

    const { date, slot, hours, totalPrice, paymentId } = req.body;

    const newBooking = new Booking({
      userId: req.userId,
      date,
      slot,
      hours,
      totalPrice,
      paymentId
    });

    await newBooking.save();

    res.status(201).json({
      success: true,
      booking: newBooking
    });

  } catch (err) {

    console.error('Booking error:', err);

    res.status(500).json({ message: 'Server error' });

  }

});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
