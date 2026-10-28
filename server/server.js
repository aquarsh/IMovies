const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
  const { router: authRouter } = require("./auth");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
  app.use("/api/auth", authRouter);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Reads the login token if there is one. Never blocks the request:
// logged-in users get req.userId, guests simply have no req.userId.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (token && process.env.JWT_SECRET) {
    try {
      req.userId = jwt.verify(
        token,
        process.env.JWT_SECRET
      ).id;
    } catch (error) {
      // invalid or expired token: treat as a guest
    }
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    message: "IMovies backend is running!",
    status: "success"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected"
  });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Booking schema
const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true
  },
  movieId: {
    type: String,
    required: true
  },
  movieTitle: {
    type: String,
    required: true
  },
  poster: String,
  theatre: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  seats: {
    type: [String],
    required: true
  },
  total: Number,
  paymentMethod: String,
  createdAt: String,
  // Who made this booking (empty for old bookings made before login)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
});

const Booking =
  mongoose.models.Booking ||
  mongoose.model("Booking", bookingSchema);

// Find bookings for the exact movie, theatre, date and showtime
function showFilter({
  movieId,
  movieTitle,
  date,
  time,
  theatre
}) {
  const movieConditions = [];

  if (movieId) {
    movieConditions.push({ movieId: String(movieId) });
  }

  if (movieTitle) {
    movieConditions.push({ movieTitle });
  }

  const conditions = [{ date, time }];

  if (movieConditions.length === 1) {
    conditions.push(movieConditions[0]);
  } else if (movieConditions.length > 1) {
    conditions.push({ $or: movieConditions });
  }

  if (theatre) {
    conditions.push({
      $or: [
        { theatre },
        { theatre: { $exists: false } },
        { theatre: null },
        { theatre: "" }
      ]
    });
  }

  return { $and: conditions };
}

// Get seats already booked for a particular show
// (public on purpose: everyone must see which seats are taken,
// but only seat numbers are returned, never who booked them)
app.get("/api/booked-seats", async (req, res) => {
  try {
    const {
      movieId,
      movieTitle,
      date,
      time,
      theatre
    } = req.query;

    if (
      !date ||
      !time ||
      (!movieId && !movieTitle) ||
      !theatre
    ) {
      return res.status(400).json({
        message:
          "Movie, date, theatre and time are required."
      });
    }

    const bookings = await Booking.find(
      showFilter({
        movieId,
        movieTitle,
        date,
        time,
        theatre
      })
    ).select("seats -_id");

    const bookedSeats = [
      ...new Set(
        bookings.flatMap((booking) => booking.seats || [])
      )
    ];

    res.json({ bookedSeats });
  } catch (error) {
    console.error("FETCH BOOKED SEATS ERROR:", error);

    res.status(500).json({
      message: error.message
    });
  }
});

// Get the logged-in user's own bookings only
app.get("/api/bookings", optionalAuth, async (req, res) => {
  try {
    // Guests have no bookings of their own
    if (!req.userId) {
      return res.json([]);
    }

    const bookings = await Booking.find({
      user: req.userId
    }).sort({
      _id: -1
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// Save a booking and prevent duplicate seats
app.post("/api/bookings", optionalAuth, async (req, res) => {
  try {
    const {
      bookingId,
      movieId,
      movieTitle,
      date,
      time,
      theatre,
      seats
    } = req.body;

    if (
      !bookingId ||
      (!movieId && !movieTitle) ||
      !date ||
      !time ||
      !theatre ||
      !Array.isArray(seats) ||
      seats.length === 0
    ) {
      return res.status(400).json({
        message:
          "Movie, date, theatre, time, booking ID and at least one seat are required."
      });
    }

    if (new Set(seats).size !== seats.length) {
      return res.status(400).json({
        message: "The same seat cannot be selected twice."
      });
    }

    const filter = showFilter({
      movieId,
      movieTitle,
      date,
      time,
      theatre
    });

    // Check whether any requested seat is already booked
    const existingBooking = await Booking.findOne({
      ...filter,
      seats: { $in: seats }
    });

    if (existingBooking) {
      const bookings = await Booking.find(filter).select(
        "seats -_id"
      );

      const bookedSeats = [
        ...new Set(
          bookings.flatMap((booking) => booking.seats || [])
        )
      ];

      const conflictingSeats = seats.filter((seat) =>
        bookedSeats.includes(seat)
      );

      return res.status(409).json({
        message: `Seat${
          conflictingSeats.length > 1 ? "s are" : " is"
        } already booked: ${conflictingSeats.join(", ")}. Please choose available seats.`,
        bookedSeats
      });
    }

    const booking = await Booking.create({
      ...req.body,
      movieId: String(movieId || ""),
      // always taken from the login token, never from the request body
      user: req.userId || null
    });

    // Tell connected clients to refresh seat availability
    io.emit("seats-updated", {
      movieId: String(movieId || ""),
      movieTitle,
      date,
      time,
      theatre,
      seats
    });

    return res.status(201).json(booking);
  } catch (error) {
    console.error("BOOKING SAVE ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "This booking ID already exists."
      });
    }

    return res.status(400).json({
      message: error.message
    });
  }
});

// Clear the logged-in user's own bookings (never other users')
app.delete("/api/bookings", optionalAuth, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        message: "Please log in to clear your bookings."
      });
    }

    await Booking.deleteMany({ user: req.userId });

    io.emit("seats-updated", { cleared: true });

    res.json({
      message: "Your bookings were cleared"
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing from server/.env"
      );
    }

    if (!process.env.JWT_SECRET) {
      console.warn(
        "Warning: JWT_SECRET is missing, login will not work"
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");

    server.listen(PORT, () => {
      console.log(
        `IMovies backend running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
}

startServer();