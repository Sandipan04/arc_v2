import { CONFIG } from "./config.js";

window.addEventListener("load", async () => {
  testDatabaseConnection(); // Run the public DB test immediately

  if (!window.Clerk) {
    console.error("Clerk script failed to load.");
    return;
  }
  try {
    await window.Clerk.load();
    initializeUI();
  } catch (error) {
    console.error("Clerk initialization failed:", error);
  }
});

// NEW: Fetch general D1 status
async function testDatabaseConnection() {
  try {
    const res = await fetch("/api/debug");
    const data = await res.json();

    const statusEl = document.getElementById("d1-status");
    if (data.success) {
      statusEl.textContent = "✅ Connected to Local D1";
      statusEl.style.color = "green";
      document.getElementById("d1-tables").textContent = data.tables.join(", ");
    } else {
      statusEl.textContent = "❌ Failed to query D1";
      statusEl.style.color = "red";
    }
  } catch (error) {
    document.getElementById("d1-status").textContent = "❌ Network Error";
  }
}

async function initializeUI() {
  const signInBtn = document.getElementById("sign-in-btn");
  const userButtonMount = document.getElementById("user-button-mount");

  if (!window.Clerk.user) {
    signInBtn.classList.remove("hidden");
    signInBtn.onclick = (e) => {
      e.preventDefault();
      window.Clerk.openSignIn();
    };
  } else {
    window.Clerk.mountUserButton(userButtonMount);
    await loadUserProfileAndEnforceRoles();
  }
}

async function loadUserProfileAndEnforceRoles() {
  try {
    const token = await window.Clerk.session.getToken();

    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      document.getElementById("raw-profile-data").textContent =
        `Error: User not found in local D1 database. \n\nBecause you are running on localhost, the Clerk Webhook failed to trigger. You must manually insert your Clerk ID into your local database.`;
      document.getElementById("raw-profile-data").style.color = "#ff6b6b";
      return;
    }

    const data = await res.json();

    // Dump the raw JSON payload to the diagnostics screen
    document.getElementById("raw-profile-data").textContent = JSON.stringify(
      data,
      null,
      2,
    );

    if (data.needsOnboarding) {
      document.getElementById("raw-profile-data").textContent +=
        "\n\n➡️ Redirecting to onboarding...";
      // Commenting out the redirect temporarily so you can see the diagnostic output
      // window.location.href = '/complete-profile.html';
      return;
    }

    const authDashboard = document.getElementById("auth-dashboard");
    authDashboard.classList.remove("hidden");

    const user = data.user;
    document.getElementById("profile-name").textContent = user.name;
    document.getElementById("profile-academic").textContent =
      `${user.program} - ${user.school_abbr}`;

    const statusSpan = document.getElementById("profile-status");
    statusSpan.textContent = user.status.toUpperCase();
    statusSpan.className = `badge badge-${user.status}`;
    document.getElementById("profile-role").textContent =
      user.role.toUpperCase();

    if (user.status === "approved") {
      document.getElementById("upload-btn").classList.remove("hidden");
      if (user.role === "moderator" || user.role === "admin") {
        document.getElementById("mod-btn").classList.remove("hidden");
      }
      if (user.role === "admin") {
        document.getElementById("admin-btn").classList.remove("hidden");
      }
    } else {
      document.getElementById("pending-notice").classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error loading profile flow:", error);
  }
}
