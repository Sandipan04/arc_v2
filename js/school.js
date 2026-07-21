import { initializeClerk } from "./core/auth.js";
import { mountComments } from "./comments.js"; // <-- 1. Import the comments module

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Get the school abbreviation from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const schoolAbbr = urlParams.get("abbr");

  if (!schoolAbbr) {
    document.getElementById("school-title").textContent = "School Not Found";
    document.getElementById("loading-spinner").classList.add("hidden");
    return;
  }

  // Update UI headers immediately
  document.getElementById("breadcrumb-school").textContent = schoolAbbr;
  document.getElementById("school-title").textContent = `${schoolAbbr} Courses`;

  let clerkInstance = null; // <-- 2. Declare a variable to hold the auth instance

  // 2. Initialize Auth
  try {
    clerkInstance = await initializeClerk(); // <-- 3. Assign it to our variable
    if (clerkInstance.user) {
      clerkInstance.mountUserButton(
        document.getElementById("user-button-mount"),
      );
      // NEW: Un-hide the Add Course button for logged-in users
      document
        .getElementById("open-course-modal-btn")
        .classList.remove("hidden");
      setupCourseHandler(clerkInstance, schoolAbbr);
    } else {
      const signInBtn = document.getElementById("sign-in-btn");
      signInBtn.classList.remove("hidden");
      signInBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clerkInstance.openSignIn();
      });
    }
  } catch (error) {
    console.error("Auth initialization failed:", error);
  }

  // 3. Fetch and render courses
  fetchCourses(schoolAbbr);

  // 4. Setup search filter listener
  document
    .getElementById("course-filter")
    .addEventListener("input", filterCourses);

  // 5. Mount the comments system! <-- 4. Call the function
  mountComments(clerkInstance, "comments-mount");
});

async function fetchCourses(abbr) {
  const spinner = document.getElementById("loading-spinner");
  const grid = document.getElementById("course-grid");
  const emptyState = document.getElementById("empty-state");

  try {
    const res = await fetch(`/api/courses?school=${abbr}`);
    const data = await res.json();

    spinner.classList.add("hidden");

    if (!data.success || data.courses.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    renderCourses(data.courses, grid);
  } catch (error) {
    spinner.classList.add("hidden");
    emptyState.textContent = "Failed to load courses. Please try again.";
    emptyState.classList.remove("hidden");
  }
}

function renderCourses(courses, container) {
  container.innerHTML = "";
  courses.forEach((course) => {
    // Safe fallback in case course.name is missing
    const courseName = course.name || "Untitled Course";

    const card = document.createElement("div");
    card.className = "col-md-6 col-lg-4 course-item";
    card.innerHTML = `
            <div class="card h-100 course-card shadow-sm" onclick="window.location.href='/course.html?id=${course.id}'">
                <div class="card-body">
                    <h5 class="card-title text-primary code-title">${course.code}</h5>
                    <p class="card-text text-dark name-text">${courseName}</p>
                </div>
            </div>
        `;
    container.appendChild(card);
  });
}

function filterCourses(e) {
  const term = e.target.value.toLowerCase();
  const items = document.querySelectorAll(".course-item");

  items.forEach((item) => {
    const code = item.querySelector(".code-title").textContent.toLowerCase();
    const name = item.querySelector(".name-text").textContent.toLowerCase();

    if (code.includes(term) || name.includes(term)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
}

function setupCourseHandler(clerk, schoolAbbr) {
  const form = document.getElementById("course-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-course-btn");
    const errorDiv = document.getElementById("course-error");

    btn.disabled = true;
    btn.textContent = "Submitting...";
    errorDiv.classList.add("hidden");

    const payload = {
      school_abbr: schoolAbbr,
      code: document.getElementById("course-code").value,
      name: document.getElementById("course-name").value,
    };

    try {
      const token = await clerk.session.getToken();
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        window.location.reload(); // Reload to see the new course immediately
      } else {
        throw new Error(data.error || "Failed to create course.");
      }
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Submit Course for Review";
    }
  });
}
