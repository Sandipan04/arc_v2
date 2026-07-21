import { initializeClerk } from "./core/auth.js";
import { mountComments } from "./comments.js";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("id");

  if (!courseId) return;

  let clerkInstance = null; // Store reference to pass down

  try {
    const clerk = await initializeClerk();
    clerkInstance = clerk; // Save for comments
    if (clerk.user) {
      clerk.mountUserButton(document.getElementById("user-button-mount"));
      document
        .getElementById("open-iteration-modal-btn")
        .classList.remove("hidden");
      setupIterationHandler(clerk, courseId);
    }
  } catch (error) {
    console.error(error);
  }

  fetchCourseDetails(courseId);

  // 2. Mount Comments (pass clerk instance whether user is logged in or null)
  mountComments(clerkInstance, "comments-mount");
});

async function fetchCourseDetails(courseId) {
  const container = document.getElementById("iterations-container");
  try {
    const res = await fetch(`/api/course?id=${courseId}`);
    const data = await res.json();
    document.getElementById("loading-spinner").classList.add("hidden");

    if (data.success) {
      document.getElementById("course-code").textContent = data.course.code;
      document.getElementById("course-name").textContent = data.course.name;
      document.getElementById("school-link").textContent =
        data.course.school_abbr;
      document.getElementById("school-link").href =
        `/school.html?abbr=${data.course.school_abbr}`;

      if (data.iterations.length === 0) {
        document.getElementById("empty-state").classList.remove("hidden");
      } else {
        data.iterations.forEach((it) => {
          const card = document.createElement("a");
          card.href = `/iteration.html?id=${it.id}`;
          card.className = "text-decoration-none";
          card.innerHTML = `
                        <div class="card shadow-sm border-0 iteration-card">
                            <div class="card-body p-4 d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 text-dark fw-bold">📅 ${it.year} — ${it.sem} Semester <span class="text-muted fs-6 fw-normal">(Instructor: ${it.inst})</span></h5>
                                <span class="btn btn-outline-primary btn-sm rounded-pill px-3">View Resources ➔</span>
                            </div>
                        </div>
                    `;
          container.appendChild(card);
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function setupIterationHandler(clerk, courseId) {
  const form = document.getElementById("iteration-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-iter-btn");
    btn.disabled = true;
    btn.textContent = "Creating...";

    const payload = {
      course_id: courseId,
      year: document.getElementById("iter-year").value,
      sem: document.getElementById("iter-sem").value,
      inst: document.getElementById("iter-inst").value.trim() || "Unknown",
    };

    try {
      const token = await clerk.session.getToken();
      const res = await fetch("/api/iteration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) window.location.reload();
      else throw new Error(data.error);
    } catch (err) {
      document.getElementById("iteration-error").textContent = err.message;
      document.getElementById("iteration-error").classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Create Iteration";
    }
  });
}
