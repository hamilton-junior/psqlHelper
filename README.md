# PSQL Buddy - Local Setup

This project is a Visual PostgreSQL Query Builder powered by Google Gemini AI.

## Prerequisites

1.  **Node.js**: Ensure you have Node.js installed (version 18+ recommended).
2.  **Gemini API Key**: You need an API key from Google AI Studio.

## Installation

1.  Install Node dependencies:
    ```bash
    npm install
    ```

## Setup API Key

Create a `.env` file in the root directory and add your Google Gemini API key:

```env
VITE_API_KEY=your_actual_api_key_here
```

## Running Locally

Start the development environment (Vite + Node.js Backend + Electron):

```bash
npm start
```

Open your browser to `http://localhost:5173` (or use the Electron window).

## Project Structure

*   `main.js`: Electron entry point (handles updates from GitHub).
*   `server.js`: Node.js Express backend for Postgres interaction.
*   `src/`: React frontend.
