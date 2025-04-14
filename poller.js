const axios = require('axios');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI;
const SPLITWISE_API_KEY = process.env.API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK;

const FETCH_URL = process.env.FETCH_URL;

async function poll() {
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
  
      if (response.status === 401) {
        console.error('❌ Error during Hitting Splitwise:', response);
        return;
      }
  
      const currentData = response.data.notifications;
      
      // Step 2: Get the last snapshot from MongoDB
      const lastDoc = await tracking.findOne({ _id: 'last_snapshot' });
      const lastData = lastDoc ? lastDoc.data : [];
  
      // Step 3: Compare data and extract new notifications
      const lastIds = new Set(lastData.map(n => n.id));
      const newNotifications = currentData.filter(n => !lastIds.has(n.id));
  
      if (newNotifications.length > 0) {
        console.log(`🔔 ${newNotifications.length} new notification(s) detected. Sending webhook...`);
  
        // Step 4: Trigger webhook with only new notifications
        await axios.post(WEBHOOK_URL, {
          event: 'splitwise_notifications_updated',
          payload: newNotifications
        });
  
        // Step 5: Update snapshot in DB
        await tracking.updateOne(
          { _id: 'last_snapshot' },
          { $set: { data: currentData } },
          { upsert: true }
        );
  
        // Step 6: Log the new notifications
        await tracking.insertOne({
          type: 'notification',
          timestamp: new Date(),
          // payload: newNotifications
        });
      } else {
        console.log('✅ No new notifications.');
      }
    } catch (err) {
      console.error('❌ Error during polling:', err.message);
    } finally {
      await client.close();
    }
}
  

poll();
