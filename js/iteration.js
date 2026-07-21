import { initializeClerk } from "./core/auth.js";
import { mountComments } from "./comments.js";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const iterId = urlParams.get("id");
  if (!iterId) return;

  let clerkInstance = null; // Store reference to pass down

  try {
    const clerk = await initializeClerk();
    clerkInstance = clerk; // Save for comments
    if (clerk.user) {
      clerk.mountUserButton(document.getElementById("user-button-mount"));
      document
        .getElementById("open-iteration-modal-btn")
        .classList.remove("hidden");
      setupIterationHandler(clerk, iterId);
    }
  } catch (error) {
    console.error(error);
  }

  fetchIterationDetails(iterId);

  // 2. Mount Comments (pass clerk instance whether user is logged in or null)
  mountComments(clerkInstance, "comments-mount");
});

async function fetchIterationDetails(iterId) {
  try {
    const res = await fetch(`/api/iteration?id=${iterId}`);
    const data = await res.json();

    if (data.success) {
      const { iteration, items } = data;

      // Populate Headers & Breadcrumbs
      document.getElementById("iter-title").textContent =
        `${iteration.year} — ${iteration.sem} Semester`;
      document.getElementById("iter-subtitle").textContent =
        `${iteration.course_code}: ${iteration.course_name} | Inst: ${iteration.inst}`;
      document.getElementById("iter-breadcrumb").textContent =
        `${iteration.year} ${iteration.sem}`;

      const schoolLink = document.getElementById("school-link");
      schoolLink.textContent = iteration.school_abbr;
      schoolLink.href = `/school.html?abbr=${iteration.school_abbr}`;

      const courseLink = document.getElementById("course-link");
      courseLink.textContent = iteration.course_code;
      courseLink.href = `/course.html?id=${iteration.course_id}`;

      // Render Files
      const container = document.getElementById("files-container");
      if (items.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-muted">No files uploaded yet.</div>`;
      } else {
        items.forEach((file) => {
          container.innerHTML += `
                        <div class="list-group-item d-flex justify-content-between align-items-center py-3">
                            <div>
                                <h6 class="mb-1 fw-semibold">${file.name}</h6>
                                <p class="mb-1 text-muted small">${file.description || ""}</p>
                                <small class="text-secondary">By ${file.uploader_name} on ${new Date(file.created_at).toLocaleDateString()}</small>
                            </div>
                            <div class="d-flex gap-2 flex-wrap justify-content-end mt-2 mt-sm-0">
                                <a href="/api/file?id=${file.id}&action=view" target="_blank" class="btn btn-outline-secondary btn-sm px-3">
                                    👁️ View
                                </a>
                                <a href="/api/file?id=${file.id}&action=download" class="btn btn-primary btn-sm px-3">
                                    ⬇️ Download
                                </a>
                            </div>
                        </div>
                    `;
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Add this helper function at the bottom of iteration.js
async function calculateFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Complete the setupUploadHandler function
async function setupUploadHandler(clerk, iterId) {
  const form = document.getElementById("upload-form");
  const submitBtn = document.getElementById("submit-upload-btn");

  // Create an error banner inside the modal if it doesn't exist
  let errorDiv = document.getElementById("upload-error");
  if (!errorDiv) {
    errorDiv = document.createElement("div");
    errorDiv.id = "upload-error";
    errorDiv.className = "alert alert-danger hidden mb-3";
    form.prepend(errorDiv);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorDiv.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Calculating Hash & Uploading...";

    const fileInput = document.getElementById("file-input");
    const file = fileInput.files[0];

    try {
      const fileHash = await calculateFileHash(file);
      const token = await clerk.session.getToken();

      const formData = new FormData();
      formData.append("iteration_id", iterId);
      formData.append(
        "title",
        document.getElementById("file-title").value.trim(),
      );
      formData.append(
        "description",
        document.getElementById("file-description").value.trim(),
      );
      formData.append("file_hash", fileHash);
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.reload();
      } else {
        throw new Error(data.error || "Upload failed.");
      }
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Upload";
    }
  });
}
