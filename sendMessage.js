// sendMessage.js
import express from 'express';
import qs from 'qs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.post('/', async (req, res) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const kakaoAccessToken = authorizationHeader.split(' ')[1];
  if (!kakaoAccessToken) {
    return res.status(401).json({ error: 'Kakao access token missing' });
  }

  const { uuid, templateType, templateData } = req.body;
  if (!uuid || !templateType || !templateData) {
    return res.status(400).json({ error: 'Missing UUID, templateType, or templateData' });
  }

  try {
    let templateObject;

    // template type branch
    if (templateType === 'text') {
      const { title, message, url } = templateData;

      if (!title || !message || !url) {
        return res.status(400).json({ error: 'Missing required fields for text template' });
      }

      templateObject = {
        object_type: 'text',
        text: `${title}\n\n${message}`,
        link: {
          web_url: url,
          mobile_web_url: url,
        },
        button_title: '자세히 보기',
      };
    } else if (templateType === 'image') {
      const { title, message, imageUrl, url } = templateData;

      if (!title || !message || !imageUrl || !url) {
        return res.status(400).json({ error: 'Missing required fields for image template' });
      }

      templateObject = {
        object_type: 'feed',
        content: {
          title: title,
          description: message,
          image_url: imageUrl,
          link: {
            web_url: url,
            mobile_web_url: url,
          },
        },
        buttons: [
          {
            title: '자세히 보기',
            link: {
              web_url: url,
              mobile_web_url: url,
            },
          },
        ],
      };
    } else {
      return res.status(400).json({ error: 'Invalid templateType' });
    }

    // kakao message send request data creation
    const requestBody = {
      receiver_uuids: JSON.stringify([uuid]),
      template_object: JSON.stringify(templateObject),
    };

    const response = await axios.post(
      'https://kapi.kakao.com/v1/api/talk/friends/message/default/send',
      qs.stringify(requestBody),
      {
        headers: {
          Authorization: `Bearer ${kakaoAccessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('Kakao API Response:', response.data);
    res.json({ status: 'Message sent successfully', details: response.data });
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    res.status(500).json({ error: 'Message sending failed', details: error.response?.data || error.message });
  }
});

export default router;
