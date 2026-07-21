import { initializeClerk, fetchUserProfile } from "./core/auth.js";
import { mountComments } from "./comments.js"; // <-- 1. Import the comments module

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Fetch public data immediately
  fetchSchools();

  let clerkInstance = null; // <-- 2. Declare a variable to hold the auth instance

  // 2. Initialize Clerk Auth
  try {
    clerkInstance = await initializeClerk(); // <-- 3. Assign it to our variable

    const signInBtn = document.getElementById("sign-in-btn");
    const userButtonMount = document.getElementById("user-button-mount");
    const authAlert = document.getElementById("auth-alert");
    const authAlertText = document.getElementById("auth-alert-text");

    // Handle UI state based on session
    if (!clerkInstance.user) {
      signInBtn.classList.remove("hidden");
      signInBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clerkInstance.openSignIn();
      });
    } else {
      clerkInstance.mountUserButton(userButtonMount);

      try {
        const userData = await fetchUserProfile();

        if (userData.needsOnboarding) {
          window.location.href = "/complete-profile.html";
          return;
        }

        if (userData.user.status !== "approved") {
          authAlertText.textContent =
            "Your account is pending admin approval. You can browse, but cannot upload files.";
          authAlert.classList.remove("hidden");
        }
      } catch (dbError) {
        console.error("Database user fetch error:", dbError);
        authAlertText.textContent =
          "Unable to sync profile with database. Ensure Wrangler is running.";
        authAlert.classList.remove("hidden");
      }
    }
  } catch (error) {
    console.error("Homepage initialization failed:", error);
  }

  // 4. Mount the global site comments! <-- Call the function
  mountComments(clerkInstance, "comments-mount");
});

// Function to fetch and render schools dynamically
async function fetchSchools() {
  const grid = document.getElementById("schools-grid");
  const loading = document.getElementById("schools-loading");
  const errorDiv = document.getElementById("schools-error");

  try {
    const res = await fetch("/api/schools");
    const data = await res.json();

    loading.classList.add("hidden");

    if (res.ok && data.success) {
      if (data.schools.length === 0) {
        errorDiv.textContent = "No schools found in the database.";
        errorDiv.classList.remove("hidden");
        return;
      }

      data.schools.forEach((school) => {
        const card = document.createElement("div");
        card.className = "col-md-4 col-lg-3";
        card.innerHTML = `
                    <div class="card school-card h-100 shadow-sm" onclick="window.location.href='/school.html?abbr=${school.abbr}'">
                        <div class="card-body text-center d-flex flex-column justify-content-center py-4">
                            <h5 class="card-title text-primary fw-bold mb-2">${school.abbr}</h5>
                            <p class="card-text text-muted small mb-0">${school.name}</p>
                        </div>
                    </div>
                `;
        grid.appendChild(card);
      });
    } else {
      throw new Error(data.error || "Failed to load schools.");
    }
  } catch (error) {
    loading.classList.add("hidden");
    errorDiv.textContent = `Error loading directory: ${error.message}`;
    errorDiv.classList.remove("hidden");
  }
}
