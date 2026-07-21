import { initializeClerk } from "./core/auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const clerk = await initializeClerk();

    if (!clerk.user) {
      window.location.href = "/"; // Kick unauthenticated users out
      return;
    }

    // Mount the avatar so they know who they are signed in as
    clerk.mountUserButton(document.getElementById("user-button-mount"));

    const form = document.getElementById("onboarding-form");
    const errorDiv = document.getElementById("error-message");
    const submitBtn = document.getElementById("submit-btn");

    // Pre-fill the name field with their Google/Clerk name if available
    if (clerk.user.fullName) {
      document.getElementById("username").value = clerk.user.fullName;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); // Stop the browser from refreshing the page

      // Reset UI state
      errorDiv.classList.add("hidden");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      const payload = {
        username: document.getElementById("username").value.trim(),
        program: document.getElementById("program").value,
        school: document.getElementById("school").value,
        batch: document.getElementById("batch").value || null,
        about: document.getElementById("about").value.trim() || null,
      };

      try {
        const token = await clerk.session.getToken();

        const res = await fetch("/api/users/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Update successful, break the loop by sending them home
          window.location.href = "/";
        } else {
          // Backend rejected it
          errorDiv.textContent =
            data.error || "Failed to update profile in database.";
          errorDiv.classList.remove("hidden");
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Profile";
        }
      } catch (err) {
        // Network error
        errorDiv.textContent = "Network error. Make sure Wrangler is running.";
        errorDiv.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Profile";
      }
    });
  } catch (error) {
    console.error("Initialization failed:", error);
  }
});
