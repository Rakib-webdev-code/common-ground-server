
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyToken } from './middlewares/verify-token.js';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

try {
  // await client.connect();
  await client.db('admin').command({ ping: 1 });
  console.log('Connected to MongoDB!');
} catch (error) {
  console.error('MongoDB connection failed:', error.message);
  process.exit(1);
}

// Database and collections
const db = client.db(process.env.MONGODB_DATABASE);
const eventsCollection = db.collection('events');
const joinedEventsCollection = db.collection('joinedEvents');

// Root route
app.get('/', (req, res) => {
  res.send('Common Ground server is running');
});

// Get all upcoming events
app.get('/api/events', async (req, res) => {
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
    console.error('Error fetching events:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
    });
  }
});

// Get six nearest upcoming events
app.get('/api/events/recent', async (req, res) => {
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
    console.error('Error fetching recent events:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent events',
    });
  }
});

// Create a new event (Protected API)
app.post('/api/events', verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !description?.trim() ||
      !eventType?.trim() ||
      !thumbnail?.trim() ||
      !location?.trim() ||
      !eventDate
    ) {
      return res.status(400).json({
        success: false,
        message: 'All event fields are required.',
      });
    }

    // Validate thumbnail URL
    try {
      const imageUrl = new URL(thumbnail);

      if (!['http:', 'https:'].includes(imageUrl.protocol)) {
        throw new Error('Invalid image URL');
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid thumbnail URL.',
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
        message: 'Event date must be a valid future date.',
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
      message: 'Event created successfully!',
      data: {
        _id: result.insertedId,
        ...newEvent,
      },
    });
  } catch (error) {
    console.error('Error creating event:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to create event.',
    });
  }
});

// Get a single event by ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID.',
      });
    }

    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Error fetching event:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch event.',
    });
  }
});

// Temporary JWT verification test route
app.get('/api/auth-check', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'JWT verified successfully!',
    user: {
      id: req.user.id,
    },
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
