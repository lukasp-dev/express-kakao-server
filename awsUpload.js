import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Multer config (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed'));
  },
});

// AWS S3 config (v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION, // ex) 'ap-northeast-2'
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, // get from env
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // get from env
  },
});

// test GET route
router.get('/', (req, res) => {
  res.send('Upload endpoint is working');
});

// image upload endpoint
router.post('/', upload.single('image'), async (req, res) => {
console.log('Received POST /upload request');

  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  const fileExtension = path.extname(file.originalname);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME, // get from env
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL: 'public-read', // remove
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return res.status(200).json({ imageUrl });
  } catch (err) {
    console.error('S3 업로드 에러:', err);
    return res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
  }
});

export default router;
