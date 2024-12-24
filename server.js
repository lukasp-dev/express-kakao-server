import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import awsUpload from './awsUpload.js'; // image upload router
import sendMessageRoute from './sendMessage.js'; // message send router

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const allowedOrigins = [
    'http://localhost:5173',          // local dev server
    'https://message.gallerysoma.co.kr',       // prod domain 1
  ];

// CORS 
app.use(cors({
    origin: function(origin, callback) {
        // requests w/o origin are allowed: ex) curl, mobile app, etc.
      if (!origin) return callback(null, true);
  
      if (allowedOrigins.includes(origin)) {
        // if origin is in the allowed list, allow it
        callback(null, true);
      } else {
        // if origin is not in the allowed list, reject it
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, 
  }));


// body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// rotuer config
app.use('/upload', awsUpload); // awsUpload router mounted at /upload
app.use('/send-message', sendMessageRoute); // sendMessageRoute router mounted at /send-message

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Verify Token endpoint
app.get('/verify-token', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer 토큰에서 추출

  if (!token) {
    return res.status(400).json({ error: 'Access token is required' });
  }

  try {
    const response = await axios.get('https://kapi.kakao.com/v1/user/access_token_info', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    res.json(response.data); // kakao response
  } catch (error) {
    console.error('Failed to verify token:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to verify token',
      details: error.response?.data || error.message,
    });
  }
});

// OAuth Token endpoint
app.post('/oauth/token', async (req, res) => {
  const { code } = req.body;

  console.log('Received code:', code); 

  const url = 'https://kauth.kakao.com/oauth/token';
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    code,
    client_secret: process.env.KAKAO_CLIENT_SECRET || '', 
  });

  try {
    const response = await axios.post(url, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('Kakao response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching access token:', error.response?.data || error.message); 
    res.status(500).json({
      error: 'Failed to fetch access token',
      details: error.response?.data || error.message,
    });
  }
});

// Friends endpoint
app.get('/friends', async (req, res) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return res.status(401).json({ error: 'Authorization header is missing. Please include it in the request.' });
    }

    const kakaoAccessToken = authorizationHeader.split(' ')[1];
    if (!kakaoAccessToken) {
      return res.status(401).json({ error: 'Kakao access token is missing in the Authorization header.' });
    }

    console.log('Using Kakao Access Token:', kakaoAccessToken);

    // kakao api call
    const response = await axios.get('https://kapi.kakao.com/v1/api/talk/friends', {
      headers: {
        Authorization: `Bearer ${kakaoAccessToken}`,
      },
    });

    console.log('Kakao API Response:', response.data); 
    res.json(response.data); 
  } catch (error) {
    // error handling
    if (error.response) {
      console.error('Error fetching friends from Kakao API:', error.response.data);
      const { status, data } = error.response;

      // kakao api error code
      if (status === 401) {
        return res.status(401).json({
          error: 'Invalid or expired Kakao access token.',
          details: data,
        });
      }
      return res.status(status).json({
        error: 'Kakao API returned an error.',
        details: data,
      });
    }

    console.error('Unexpected error:', error.message);
    res.status(500).json({
      error: 'Internal server error occurred while fetching friends.',
      details: error.message,
    });
  }
});

// Logout endpoint
app.post('/logout', async (req, res) => {
  const accessToken = req.headers['authorization']?.split(' ')[1];

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token is required' });
  }

  try {
    // kakao logout api call
    const response = await axios.post(
      'https://kapi.kakao.com/v1/user/logout',
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('Logout successful:', response.data);

    // client success message
    return res.json({ message: 'Successfully logged out', ...response.data });
  } catch (error) {
    console.error('Error during logout:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Logout failed', details: error.response?.data || error.message });
  }
});

// error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// router mounted logs
console.log('AWS Upload Router mounted at /upload');
console.log('Send Message Router mounted at /send-message'); 

// server start
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
