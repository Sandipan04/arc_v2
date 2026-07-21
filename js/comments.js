export async function mountComments(clerk, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Normalize the path slug (e.g., "/course?id=course_m101")
  const pathSlug =
    window.location.pathname.replace(".html", "") + window.location.search;

  // Build the structural HTML
  container.innerHTML = `
        <div class="comments-section mt-5 border-top pt-4">
            <h4 class="mb-4">Community Discussion</h4>

            <!-- Comment Input Area -->
            <div id="comment-composer" class="mb-4">
                ${
                  clerk && clerk.user
                    ? `
                    <form id="comment-form">
                        <textarea class="form-control mb-2" id="comment-content" rows="3" placeholder="Share your thoughts, ask a question, or provide feedback..." required></textarea>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">Posting as <span class="fw-semibold">${clerk.user.fullName}</span></small>
                            <button type="submit" class="btn btn-primary" id="submit-comment-btn">Post Comment</button>
                        </div>
                        <div id="comment-error" class="alert alert-danger hidden mt-2 py-2 small"></div>
                    </form>
                `
                    : `
                    <div class="bg-light p-4 rounded-3 text-center border">
                        <p class="text-muted mb-2">You must be signed in to join the discussion.</p>
                        <button class="btn btn-outline-primary btn-sm px-4" id="comment-signin-btn">Sign In to Comment</button>
                    </div>
                `
                }
            </div>

            <!-- Comments List -->
            <div id="comments-list" class="d-flex flex-column gap-3">
                <div class="text-center text-muted py-3">Loading comments...</div>
            </div>
        </div>
    `;

  // Handle Login Button (if unauthenticated)
  if (!clerk || !clerk.user) {
    document
      .getElementById("comment-signin-btn")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        clerk.openSignIn();
      });
  }

  // Fetch and Render Comments
  async function loadComments() {
    const listDiv = document.getElementById("comments-list");
    try {
      const res = await fetch(
        `/api/comments?path=${encodeURIComponent(pathSlug)}`,
      );
      const data = await res.json();

      if (data.success) {
        if (data.comments.length === 0) {
          listDiv.innerHTML = `<div class="text-center text-muted py-4 bg-light rounded border-dashed">No comments yet. Be the first to start the discussion!</div>`;
          return;
        }

        listDiv.innerHTML = data.comments
          .map(
            (c) => `
                    <div class="card border-0 shadow-sm">
                        <div class="card-body py-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="fw-bold text-dark">${c.user_name}</span>
                                <small class="text-muted">${new Date(c.created_at).toLocaleDateString()} at ${new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                            </div>
                            <p class="mb-0 text-secondary" style="white-space: pre-wrap;">${c.content}</p>
                        </div>
                    </div>
                `,
          )
          .join("");
      }
    } catch (err) {
      listDiv.innerHTML = `<div class="text-danger small">Failed to load comments.</div>`;
    }
  }

  // Handle form submission (if authenticated)
  if (clerk && clerk.user) {
    const form = document.getElementById("comment-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submit-comment-btn");
      const errorDiv = document.getElementById("comment-error");
      const contentInput = document.getElementById("comment-content");

      btn.disabled = true;
      btn.textContent = "Posting...";
      errorDiv.classList.add("hidden");

      try {
        const token = await clerk.session.getToken();
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            path_slug: pathSlug,
            content: contentInput.value,
          }),
        });

        const data = await res.json();
        if (data.success) {
          contentInput.value = "";
          await loadComments(); // Reload the list instantly
        } else {
          throw new Error(data.error || "Failed to post.");
        }
      } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "Post Comment";
      }
    });
  }

  // Initialize list
  await loadComments();
}
