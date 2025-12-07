# Dev Log: Evolving the Beinong Daily Quote App - From Scraping to Stable API

Over the past two days, we transformed an unstable web scraping tool into a robust, user-friendly modern web application. This post details how we overcame technical challenges, optimized user experience, and leveraged AI to achieve our goals.

## 1. The Challenge: Overcoming Unstable Data Sources

The biggest bottleneck initially was data acquisition. The original implementation used Puppeteer to scrape the "Taipei Agricultural Products Marketing Corporation" website. This approach had several fatal flaws:
*   **Instability**: Minor changes in the website's DOM structure would break the scraper.
*   **Slowness**: Launching a headless browser consumes significant resources and takes time.
*   **High Maintenance**: Constant fixes were required whenever the target site updated its UI.

### The Solution: Switching to Open Data
With AI assistance, we evaluated and switched to the **Ministry of Agriculture (MOA) Open Data API**.
*   **Stability**: The API provides standardized JSON data, immune to frontend UI changes.
*   **Efficiency**: Direct HTTP requests are significantly faster than browser simulation.
*   **Accuracy**: An official data source ensures the reliability of the quotes.

## 2. Intelligent Data Management

After solving the data source issue, we focused on how to manage this data effectively.

### Single Backup Strategy
The original design created a new JSON file for every query, leading to a clutter of thousands of files. We adopted a "Single Backup" strategy, maintaining only `latest_Vegetable.json` and `latest_Fruit.json`. This keeps the project structure clean while ensuring we always have the latest backup available for offline use or API fallbacks.

### Smart Preloading
To enable immediate productivity upon opening the app, we implemented "Smart Preloading." The system automatically fetches the day's vegetable and fruit quotes in the background on startup. This means users can enjoy full **Autocomplete** functionality immediately without needing to click "Fetch Data" first.

## 3. AI-Assisted UX Optimization

AI contributed not just code, but critical design decisions:

*   **Combined Autocomplete**: Originally, users had to switch between "Vegetable" and "Fruit" categories to search. We merged the databases, allowing users to find any product from a single input field, significantly reducing friction.
*   **Smart Weight Calculation**: Addressing the confusion of mixed units in agricultural trading (Kilograms, Grams, Catties), we implemented automatic conversion logic. The system identifies the unit, converts everything to **Kilograms**, and calculates the total weight to three decimal places, eliminating manual calculation errors.
*   **Data Preservation**: We refined the table logic to ensure that existing order rows are preserved when fetching new market data, preventing accidental data loss.

## 4. Technical Summary

This refactor leveraged the best of modern web technologies:
*   **Frontend**: Next.js + React for a fluid interactive experience.
*   **Backend**: Node.js API Routes for data fetching and file I/O.
*   **Styling**: Tailwind CSS for a clean, print-friendly interface.

Through this iteration, we demonstrated that choosing the right technical approach (switching from Scraping to API) combined with thoughtful UX considerations can elevate a simple tool into professional-grade productivity software.
