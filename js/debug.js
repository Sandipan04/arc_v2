import { initializeClerk, fetchUserProfile } from "./core/auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Fetch public database stats immediately
  fetchDbStats();

  // 2. Initialize Clerk for user identity
  try {
    const clerk = await initializeClerk();

    if (clerk.user) {
      clerk.mountUserButton(document.getElementById("user-button-mount"));
      await loadUserPayload();
    } else {
      document.getElementById("user-payload").textContent =
        "⚠️ You are not signed in. No session data available.";
    }
  } catch (error) {
    console.error("Clerk initialization failed on debug page:", error);
    document.getElementById("user-payload").textContent =
      "Error loading authentication script.";
  }
});

// Fetches row counts from the D1 backend
async function fetchDbStats() {
  const tbody = document.getElementById("db-stats-body");
  try {
    const res = await fetch("/api/debug");

    // If the worker crashed and returned HTML, catch it before .json() fails
    if (!res.ok) {
      const errorText = await res.text();
      try {
        // Try parsing it as JSON first in case our backend caught it
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `HTTP ${res.status}`);
      } catch (e) {
        // It's raw text/HTML from a Wrangler crash
        throw new Error(
          `Wrangler Error (HTTP ${res.status}): ${errorText.substring(0, 100)}...`,
        );
      }
    }

    const data = await res.json();
    tbody.innerHTML = ""; // Clear loading text

    if (data.success) {
      if (Object.keys(data.stats).length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-warning">No tables found. Did you run the schema.sql file?</td></tr>`;
        return;
      }

      for (const [table, count] of Object.entries(data.stats)) {
        tbody.innerHTML += `
                    <tr>
                        <td><code>${table}</code></td>
                        <td><span class="badge bg-primary rounded-pill">${count}</span></td>
                    </tr>`;
      }
    } else {
      tbody.innerHTML = `<tr><td colspan="2" class="text-danger">Backend Error: ${data.error}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-danger">Diagnostic Failed: ${err.message}</td></tr>`;
  }
}

// Fetches the logged-in user's profile from D1
async function loadUserPayload() {
  const payloadContainer = document.getElementById("user-payload");
  try {
    const userData = await fetchUserProfile();

    if (userData) {
      // Format and display the JSON beautifully
      payloadContainer.textContent = JSON.stringify(userData, null, 2);
    } else {
      payloadContainer.textContent =
        "Session valid, but user not found in local D1 database.";
    }
  } catch (err) {
    payloadContainer.textContent = `Failed to fetch user data.\n\nError: ${err.message}`;
    payloadContainer.style.color = "#ff6b6b";
  }
}
