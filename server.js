// ================= IMPORTS =================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ROOT ROUTES =================
app.get('/', (req, res) => res.send("Turf Booking API is running 🚀"));
app.get('/api', (req, res) => res.json({ message: "API working successfully" }));

// ================= MONGODB CONNECTION =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.log("MongoDB connection error:", err));

// ================= USER MODEL =================
const UserSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', UserSchema);

// ================= BOOKING MODEL =================
const BookingSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  slot: {
    type: String,
    required: true
  },
  hours: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Booking = mongoose.model("Booking", BookingSchema);

// ================= AUTH MIDDLEWARE =================
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ================= AUTH ROUTES =================
// Admin login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= BOOKING ROUTES =================

// Create booking
app.post('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { customerName, mobile, date, slot, hours } = req.body;

    const newBooking = new Booking({
      customerName,
      mobile,
      date,
      slot,
      hours,
      createdBy: req.userId
    });

    await newBooking.save();
    res.status(201).json({ success: true, booking: newBooking });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all bookings 
app.get('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: 'createdBy',           // ← Fixed: Changed from 'userId' to 'createdBy'
        select: 'name email',        // Get name and email of the admin
        strictPopulate: false        // ← This prevents the StrictPopulateError
      })
      .sort({ date: -1 });           // Latest bookings first

    res.json({
      success: true,
      bookings,
    });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete booking
app.delete('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const deletedBooking = await Booking.findByIdAndDelete(bookingId);

    if (!deletedBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({
      success: true,
      message: "Booking deleted successfully"
    });

  } catch (err) {
    console.error("Delete booking error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all bookings
app.get('/api/bookings', authMiddleware, async (req, res) => {

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
