# AI-Powered Ikman.lk Annex Crawler

This Google Apps Script project automatically crawls room and annex rental ads from Ikman.lk, filters them using Google's Gemini AI, checks for content-based duplicates, and sends detailed email notifications for suitable ads.

## Features

-   **Automated Crawling:** Runs every 15 minutes to find new ads.
-   **AI-Powered Filtering:** Uses Google Gemini to reject ads that are for "ladies only" or have "no cooking" restrictions.
-   **Content-Based Duplicate Check:** Rejects ads with descriptions that are 90%+ similar to already accepted ads.
-   **Smart Categorization:** Automatically sorts ads into `Rentals`, `Rejected`, and `Failures` sheets in a Google Sheet.
-   **Detailed Notifications:** Sends HTML emails with full ad details for suitable ads and alert emails for API failures.
-   **Error Handling:** Includes a retry mechanism for Gemini API calls.

## Technology Stack

-   Google Apps Script (JavaScript)
-   Google Sheets
-   Google Gemini AI

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/ikman-annex-crawler-gas.git
    cd ikman-annex-crawler-gas
    ```

2.  **Install `clasp`:**
    ```bash
    npm install -g @google/clasp
    clasp login
    ```

3.  **Create a New Google Apps Script Project:**
    Create a new, standalone Google Apps Script project. Alternatively, create a new Google Sheet and open the Apps Script editor. This will be your new project.

4.  **Push the Code to Your New Project:**
    -   Find the **Script ID** of your new project from Project Settings.
    -   Create a `.clasp.json` file in your local folder with the following content:
        ```json
        {"scriptId":"YOUR_NEW_SCRIPT_ID", "rootDir":"."}
        ```
    -   Push the code:
        ```bash
        clasp push -f
        ```

5.  **Configure Script Properties:**
    -   In your new Apps Script project, go to **Project Settings (⚙️)**.
    -   Under **Script Properties**, click **Add script property**.
    -   **Property:** `GOOGLE_API_KEY`
    -   **Value:** `[Your Google Gemini API Key]`
    -   Open the Google Sheet. In the Config tab, replace the placeholder values for Source_URL and to_email with your actual ikman.lk search URL and the email addresses where you want to receive notifications.

6.  **Initial Setup & Triggers:**
    -   Open the Google Sheet associated with the script.
    -   Run the `1. Initial Sheet Setup` function from the `AI Annex Crawler` menu.
    -   Run the `3. Install 15-Minute Triggers` function from the same menu.

The project is now live and will run automatically.
