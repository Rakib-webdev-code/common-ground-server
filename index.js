import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

try {
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  console.log('Connected to MongoDB!');
} catch (error) {
  console.error('MongoDB connection failed:', error.message);
  process.exit(1);
}

const db = client.db(process.env.MONGODB_DATABASE);
const eventsCollection = db.collection('events');
const joinedEventsCollection = db.collection('joinedEvents');

app.get('/', (req, res) => {
  res.send('Common Ground server is running');
});

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




app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
