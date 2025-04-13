const axios = require('axios');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI;
const SPLITWISE_API_KEY = process.env.API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK;

const FETCH_URL = process.env.FETCH_URL;

async function poll() {
  console.log("MONGO URI",MONGO_URI)
  const client = new MongoClient(MONGO_URI);

  try {
   
    await client.connect();
    const db = client.db('Staybroke');
    const tracking = db.collection('notifications');

    // Step 1: Fetch Splitwise notifications
    const response = await axios.get(FETCH_URL, {
      headers: {
        Authorization: `Bearer ${SPLITWISE_API_KEY}`
      }
    });
    
    if(response.status === 401){
      console.error('❌ Error during Hitting Splitwise:', response);
    }else{
    
    const currentData = response.data.notifications;
    const currentDataString = JSON.stringify(currentData);

    // Step 2: Get the last snapshot from MongoDB
    const lastDoc = await tracking.findOne({ _id: 'last_snapshot' });
    const lastDataString = lastDoc ? JSON.stringify(lastDoc.data) : null;

    // Step 3: Compare data
    if (currentDataString !== lastDataString) {
      console.log('🔔 New notification data detected. Sending webhook...');

      // Step 4: Trigger webhook
      await axios.post(WEBHOOK_URL, {
        event: 'splitwise_notifications_updated',
        payload: currentData
      });

      // Step 5: Update snapshot in DB
      await tracking.updateOne(
        { _id: 'last_snapshot' },
        { $set: { data: currentData } },
        { upsert: true }
      );

      // Step 6: Log the event
      await tracking.insertOne({
        type: 'notification',
        timestamp: new Date(),
        payload: currentData
      });
    
    } else {
      console.log('✅ No new notifications.');
    }
  }

  } catch (err) {
    console.error('❌ Error during polling:', err.message);
  } finally {
    await client.close();
  }
}

poll();
