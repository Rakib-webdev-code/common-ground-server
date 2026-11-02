import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { verifyToken } from "./middlewares/verify-token.js";

const app = express();
const port = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  })
);

app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

try {
  // await client.connect();
  await client.db("admin").command({ ping: 1 });
  console.log("Connected to MongoDB!");
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

// Database and collections
const db = client.db(process.env.MONGODB_DATABASE);
const eventsCollection = db.collection("events");
const joinedEventsCollection = db.collection("joinedEvents");

// Create a unique index to prevent duplicate event registrations
await joinedEventsCollection.createIndex(
  {
    userId: 1,
    eventId: 1,
  },
  {
    unique: true,
    name: "unique_user_event_registration",
  },
);

// Root route
app.get("/", (req, res) => {
  res.send("Common Ground server is running");
});

// Get all upcoming events
app.get("/api/events", async (req, res) => {
  try {
    const events = await eventsCollection
      .find({
        eventDate: { $gt: new Date() },
      })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching events:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
    });
  }
});

// Get six nearest upcoming events
app.get("/api/events/recent", async (req, res) => {
  try {
    const recentEvents = await eventsCollection
      .find({
        eventDate: { $gt: new Date() },
      })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    res.status(200).json({
      success: true,
      data: recentEvents,
    });
  } catch (error) {
    console.error("Error fetching recent events:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch recent events",
    });
  }
});

// Get events created by the authenticated user (Protected API)
app.get("/api/events/my-events", verifyToken, async (req, res) => {
  try {
    const myEvents = await eventsCollection
      .find({
        creatorId: req.user.id,
      })
      .sort({ eventDate: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: myEvents,
    });
  } catch (error) {
    console.error("Error fetching user events:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your events.",
    });
  }
});


// Get events joined by the authenticated user (Protected API)
app.get("/api/events/joined", verifyToken, async (req, res) => {
  try {
    const registrations = await joinedEventsCollection
      .find({
        userId: req.user.id,
      })
      .toArray();

    if (registrations.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const eventIds = registrations.map(
      (registration) => registration.eventId,
    );

    const events = await eventsCollection
      .find({
        _id: { $in: eventIds },
      })
      .toArray();

    const registrationMap = new Map(
      registrations.map((registration) => [
        registration.eventId.toString(),
        registration.joinedAt,
      ]),
    );

    const joinedEvents = events
      .map((event) => ({
        ...event,
        joinedAt: registrationMap.get(event._id.toString()),
      }))
      .sort(
        (a, b) =>
          new Date(a.eventDate).getTime() -
          new Date(b.eventDate).getTime(),
      );

    return res.status(200).json({
      success: true,
      count: joinedEvents.length,
      data: joinedEvents,
    });
  } catch (error) {
    console.error("Error fetching joined events:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch joined events.",
    });
  }
});


// Join an upcoming event (Protected API)
app.post("/api/events/:id/join", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const eventId = new ObjectId(id);

    // Find the event
    const event = await eventsCollection.findOne({
      _id: eventId,
    });

    // Check if event exists
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Validate event date
    const eventDate = new Date(event.eventDate);

    if (Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "You cannot join an invalid or past event.",
      });
    }
    // Prepare registration document
    const registration = {
      userId: req.user.id,
      userEmail: req.user.email,
      eventId: eventId,
      joinedAt: new Date(),
    };

    // Save registration
    await joinedEventsCollection.insertOne(registration);

    return res.status(201).json({
      success: true,
      message: "You have successfully joined the event!",
      data: registration,
    });
  } catch (error) {
    // Handle duplicate registration
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already joined this event.",
      });
    }

    console.error("Error joining event:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to join event.",
    });
  }
});

// Create a new event (Protected API)
app.post("/api/events", verifyToken, async (req, res) => {
  try {
    const { title, description, eventType, thumbnail, location, eventDate } =
      req.body;

    // Validate required fields
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof eventType !== "string" ||
      !eventType.trim() ||
      typeof thumbnail !== "string" ||
      !thumbnail.trim() ||
      typeof location !== "string" ||
      !location.trim() ||
      !eventDate
    ) {
      return res.status(400).json({
        success: false,
        message: "All event fields are required.",
      });
    }

    // Validate thumbnail URL
    try {
      const imageUrl = new URL(thumbnail);

      if (!["http:", "https:"].includes(imageUrl.protocol)) {
        throw new Error("Invalid image URL");
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid thumbnail URL.",
      });
    }

    // Convert event date into JavaScript Date
    const parsedEventDate = new Date(eventDate);

    // Validate event date
    if (
      Number.isNaN(parsedEventDate.getTime()) ||
      parsedEventDate <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Event date must be a valid future date.",
      });
    }

    // Prepare event document
    const newEvent = {
      title: title.trim(),
      description: description.trim(),
      eventType: eventType.trim(),
      thumbnail: thumbnail.trim(),
      location: location.trim(),
      eventDate: parsedEventDate,

      // Creator information comes from verified JWT
      creatorId: req.user.id,
      creatorEmail: req.user.email,
      creatorName: req.user.name,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save event in MongoDB
    const result = await eventsCollection.insertOne(newEvent);

    res.status(201).json({
      success: true,
      message: "Event created successfully!",
      data: {
        _id: result.insertedId,
        ...newEvent,
      },
    });
  } catch (error) {
    console.error("Error creating event:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to create event.",
    });
  }
});

// Update an event (Protected API - Creator only)
app.patch("/api/events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // Validate request body
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update.",
      });
    }

    // Only these fields can be updated
    const allowedFields = [
      "title",
      "description",
      "eventType",
      "thumbnail",
      "location",
      "eventDate",
    ];

    const receivedFields = Object.keys(req.body);

    if (receivedFields.some((field) => !allowedFields.includes(field))) {
      return res.status(400).json({
        success: false,
        message: "Invalid or protected field provided.",
      });
    }

    const updateData = {};

    // Validate and prepare text fields
    for (const field of [
      "title",
      "description",
      "eventType",
      "thumbnail",
      "location",
    ]) {
      if (field in req.body) {
        if (typeof req.body[field] !== "string" || !req.body[field].trim()) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a non-empty string.`,
          });
        }

        updateData[field] = req.body[field].trim();
      }
    }

    // Validate thumbnail URL
    if ("thumbnail" in updateData) {
      try {
        const imageUrl = new URL(updateData.thumbnail);

        if (!["http:", "https:"].includes(imageUrl.protocol)) {
          throw new Error("Invalid image URL");
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid thumbnail URL.",
        });
      }
    }

    // Validate event date
    if ("eventDate" in req.body) {
      if (typeof req.body.eventDate !== "string") {
        return res.status(400).json({
          success: false,
          message: "Event date must be a valid date string.",
        });
      }

      const parsedEventDate = new Date(req.body.eventDate);

      if (
        Number.isNaN(parsedEventDate.getTime()) ||
        parsedEventDate <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Event date must be a valid future date.",
        });
      }

      updateData.eventDate = parsedEventDate;
    }

    // Find event
    const eventId = new ObjectId(id);
    const existingEvent = await eventsCollection.findOne({
      _id: eventId,
    });

    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Verify event ownership
    if (existingEvent.creatorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this event.",
      });
    }

    // Update event with ownership protection
    updateData.updatedAt = new Date();

    const result = await eventsCollection.updateOne(
      {
        _id: eventId,
        creatorId: req.user.id,
      },
      {
        $set: updateData,
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Get updated event
    const updatedEvent = await eventsCollection.findOne({
      _id: eventId,
    });

    res.status(200).json({
      success: true,
      message: "Event updated successfully!",
      data: updatedEvent,
    });
  } catch (error) {
    console.error("Error updating event:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update event.",
    });
  }
});

// Delete an event (Protected API - Creator only)
app.delete("/api/events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const eventId = new ObjectId(id);

    // Find the event
    const existingEvent = await eventsCollection.findOne({
      _id: eventId,
    });

    // Check if event exists
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Verify event ownership
    if (existingEvent.creatorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this event.",
      });
    }

    // Delete only if the authenticated user is the creator
    const result = await eventsCollection.deleteOne({
      _id: eventId,
      creatorId: req.user.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting event:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete event.",
    });
  }
});

// Get a single event by ID
app.get("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error fetching event:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch event.",
    });
  }
});


// Get community impact statistics (Protected API)
app.get("/api/dashboard/stats", verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user.id;

    const [
      totalEvents,
      upcomingEvents,
      participantIds,
      myCreatedEvents,
      myJoinedEvents,
    ] = await Promise.all([
      eventsCollection.countDocuments({}),

      eventsCollection.countDocuments({
        eventDate: { $gt: now },
      }),

      joinedEventsCollection.distinct("userId"),

      eventsCollection.countDocuments({
        creatorId: userId,
      }),

      joinedEventsCollection.countDocuments({
        userId,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalEvents,
        upcomingEvents,
        totalParticipants: participantIds.length,
        myCreatedEvents,
        myJoinedEvents,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics.",
    });
  }
});


// Temporary JWT verification test route
app.get("/api/auth-check", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "JWT verified successfully!",
    user: {
      id: req.user.id,
    },
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
