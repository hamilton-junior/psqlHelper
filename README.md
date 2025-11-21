# PSQL Buddy - Local Setup

This project is a Visual PostgreSQL Query Builder powered by Google Gemini AI.

## Prerequisites

1.  **Node.js**: Ensure you have Node.js installed (version 18+ recommended).
2.  **Gemini API Key**: You need an API key from Google AI Studio.

## Installation

1.  Clone or download this repository to your local machine.
2.  Open a terminal in the project root.
3.  Install dependencies:
    ```bash
    npm install
    ```

## Setup API Key

Create a `.env` file in the root directory and add your Google Gemini API key:

```env
VITE_API_KEY=your_actual_api_key_here
```
*Note: You may need to update the `geminiService.ts` to use `import.meta.env.VITE_API_KEY` instead of `process.env.API_KEY` if running via Vite locally, or configure your bundler to replace `process.env.API_KEY`.*

## Running Locally

Start the development server:

```bash
npm run dev
```

Open your browser to the URL shown (usually `http://localhost:5173`).

## Project Structure

*   `src/` (Mapped to root): Contains the application source code.
    *   `components/`: React components.
    *   `services/`: API interactions.
    *   `App.tsx`: Main application component.
*   `index.html`: Entry point.
