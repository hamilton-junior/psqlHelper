import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// ESM helpers for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

console.log(`Starting server...`);

// Helper to handle encoding errors automatically
async function queryWithFallback(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (error) {
    const errorMsg = error.message ? error.message.toLowerCase() : '';
    const isEncodingError = 
      error.code === '2