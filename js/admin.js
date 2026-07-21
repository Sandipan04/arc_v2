import { initializeClerk, fetchUserProfile } from "./core/auth.js";

let currentUserRole = "student";
let allUsersData = [];
let dirState = {
  level: "schools",
  history: [{ level: "schools", parentId: null, name: "Directory" }], // Breadcrumb history
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const clerk = await initializeClerk();
    if (!clerk.user) {
      window.location.href = "/";
      return;
    }
    window.clerkInstance = clerk;

    clerk.mountUserButton(document.getElementById("user-button-mount"));

    // 1. Enforce Security Perimeter
    const userData = await fetchUserProfile();
    currentUserRole = userData.user.role;

    if (currentUserRole === "student") {
      alert("Unauthorized Access. Returning to homepage.");
      window.location.href = "/";
      return;
    }

    // 2. Setup UI
    const badge = document.getElementById("role-badge");
    badge.textContent = currentUserRole.toUpperCase();
    badge.classList.replace(
      "bg-secondary",
      currentUserRole === "admin" ? "bg-danger" : "bg-warning",
    );
    badge.classList.add(
      currentUserRole === "admin" ? "text-white" : "text-dark",
    );

    document.getElementById("loading-overlay").classList.add("hidden");
    document.getElementById("secure-content").classList.remove("hidden");

    setupTabs();
    loadPendingQueues(clerk);
    setupActionListeners(clerk);
  } catch (error) {
    console.error("Admin initialization failed:", error);
  }
});

function setupTabs() {
  const tabs = document.querySelectorAll(".admin-nav .nav-link");
  const views = document.querySelectorAll(".admin-view");

  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      tabs.forEach((t) => t.classList.remove("active"));
      views.forEach((v) => v.classList.add("hidden"));

      tab.classList.add("active");
      const targetId = tab.getAttribute("data-target");
      document.getElementById(targetId).classList.remove("hidden");

      // Trigger load if opening the Users tab
      if (targetId === "view-users" && allUsersData.length === 0) {
        // Assuming clerk is globally available or you pass it.
        // A quick hack is to re-initialize or pass clerk globally.
        // Let's rely on a global clerkInstance.
        loadUserDatabase(window.clerkInstance);
      }

      // Trigger load if opening the Directory tab
      if (
        targetId === "view-directory" &&
        document.getElementById("table-directory").innerHTML.includes("Loading")
      ) {
        loadDirectory(window.clerkInstance);
      }
    });
  });
}

async function loadPendingQueues(clerk) {
  try {
    const token = await clerk.session.getToken();
    const res = await fetch("/api/admin/pending", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    // Render Users
    const usersTbody = document.getElementById("table-pending-users");
    if (data.users.length === 0) {
      usersTbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No pending users.</td></tr>`;
    } else {
      usersTbody.innerHTML = data.users
        .map(
          (u) => `
                <tr>
                    <td class="fw-semibold">${u.name}</td>
                    <td>${u.email}</td>
                    <td>
                    ${
                      currentUserRole === "admin"
                        ? `<button class="btn btn-sm btn-success px-3 me-1 queue-action-btn" data-type="user" data-id="${u.id}" data-action="approve">Approve</button>
                                                 <button class="btn btn-sm btn-outline-danger px-3 queue-action-btn" data-type="user" data-id="${u.id}" data-action="reject">Reject</button>`
                        : `<span class="badge bg-light text-muted border">Admins Only</span>`
                    }
                    </td>
                </tr>
            `,
        )
        .join("");
    }

    // Render Courses (Both Mods and Admins can approve courses)
    const coursesTbody = document.getElementById("table-pending-courses");
    if (data.courses.length === 0) {
      coursesTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No pending courses.</td></tr>`;
    } else {
      coursesTbody.innerHTML = data.courses
        .map(
          (c) => `
                <tr>
                    <td class="fw-bold">${c.code}</td>
                    <td>${c.name}</td>
                    <td>${c.school_abbr}</td>
                    <td>
                      <button class="btn btn-sm btn-success px-2 me-1 queue-action-btn" data-type="course" data-id="${c.id}" data-action="approve">Approve</button>
                      <button class="btn btn-sm btn-outline-danger px-2 queue-action-btn" data-type="course" data-id="${c.id}" data-action="reject">Reject</button>
                    </td>
                </tr>
            `,
        )
        .join("");
    }
  } catch (err) {
    console.error("Queue Load Error:", err);
    document.getElementById("table-pending-users").innerHTML =
      `<tr><td colspan="3" class="text-center text-danger fw-bold">Error loading user data. Check console.</td></tr>`;
    document.getElementById("table-pending-courses").innerHTML =
      `<tr><td colspan="4" class="text-center text-danger fw-bold">Error loading course data. Check console.</td></tr>`;
  }
}

async function loadUserDatabase(clerk) {
  try {
    const token = await clerk.session.getToken();
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    // Sort users: Admin (1) -> Moderator (2) -> Student (3)
    const roleWeight = { admin: 1, moderator: 2, student: 3 };
    allUsersData = data.users.sort(
      (a, b) => roleWeight[a.role] - roleWeight[b.role],
    );

    renderUserDatabase(allUsersData);

    // Hook up search filter
    document.getElementById("user-search").addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allUsersData.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term),
      );
      renderUserDatabase(filtered);
    });
  } catch (err) {
    console.error(err);
    document.getElementById("table-all-users").innerHTML =
      `<tr><td colspan="5" class="text-danger">Error loading users.</td></tr>`;
  }
}

function renderUserDatabase(users) {
  const tbody = document.getElementById("table-all-users");
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No users found.</td></tr>`;
    return;
  }

  // Get current user ID to prevent self-demotion
  const currentUserId = window.clerkInstance.user.id;

  tbody.innerHTML = users
    .map((u) => {
      let actionButtons = "";

      if (u.id === currentUserId) {
        // Safeguard: Prevent modifying yourself
        actionButtons = `<span class="badge bg-light text-muted border">You</span>`;
      } else if (currentUserRole === "admin") {
        // Admin viewing other users
        if (u.role === "admin") {
          actionButtons += `<button class="btn btn-sm btn-outline-warning px-2 me-1 queue-action-btn" data-type="user" data-id="${u.id}" data-action="demote_mod">Demote to Mod</button>`;
          actionButtons += `<button class="btn btn-sm btn-danger px-2 queue-action-btn" data-type="user" data-id="${u.id}" data-action="revoke">Revoke</button>`;
        } else if (u.role === "moderator") {
          actionButtons += `<button class="btn btn-sm btn-outline-success px-2 me-1 queue-action-btn" data-type="user" data-id="${u.id}" data-action="promote_admin">Make Admin</button>`;
          actionButtons += `<button class="btn btn-sm btn-outline-secondary px-2 me-1 queue-action-btn" data-type="user" data-id="${u.id}" data-action="demote_student">Demote to Student</button>`;
          actionButtons += `<button class="btn btn-sm btn-danger px-2 queue-action-btn" data-type="user" data-id="${u.id}" data-action="revoke">Revoke</button>`;
        } else if (u.role === "student") {
          actionButtons += `<button class="btn btn-sm btn-outline-primary px-2 me-1 queue-action-btn" data-type="user" data-id="${u.id}" data-action="promote_mod">Make Mod</button>`;
          actionButtons += `<button class="btn btn-sm btn-danger px-2 queue-action-btn" data-type="user" data-id="${u.id}" data-action="revoke">Revoke</button>`;
        }
      } else if (currentUserRole === "moderator") {
        // Moderator viewing other users
        if (u.role === "admin") {
          actionButtons = `<span class="badge bg-light text-muted border">System Admin</span>`;
        } else if (u.role === "moderator") {
          actionButtons += `<button class="btn btn-sm btn-outline-secondary px-2 me-1 queue-action-btn" data-type="user" data-id="${u.id}" data-action="demote_student">Demote to Student</button>`;
        } else if (u.role === "student") {
          actionButtons += `<button class="btn btn-sm btn-outline-primary px-2 me-1 queue-action-btn" data-type="user" data-id="${u.id}" data-action="promote_mod">Make Mod</button>`;
        }
      }

      const roleBadge =
        u.role === "admin"
          ? "bg-danger"
          : u.role === "moderator"
            ? "bg-primary"
            : "bg-secondary";
      const statusBadge =
        u.status === "approved"
          ? "text-success"
          : u.status === "pending"
            ? "text-warning"
            : "text-danger";

      return `
            <tr>
                <td class="fw-semibold">${u.name}</td>
                <td>${u.email}</td>
                <td><span class="badge ${roleBadge}">${u.role}</span></td>
                <td class="fw-bold ${statusBadge}">${u.status}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    })
    .join("");
}

async function loadDirectory(clerk) {
  const tbody = document.getElementById("table-directory");
  tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Loading...</td></tr>`;

  // Determine current state
  const current = dirState.history[dirState.history.length - 1];

  // Update Header UI
  const backBtn = document.getElementById("dir-back-btn");
  const breadcrumbs = document.getElementById("dir-breadcrumbs");
  const addBtn = document.getElementById("dir-add-btn");

  // Toggle Back button
  if (dirState.history.length > 1) {
    backBtn.classList.remove("hidden");
  } else {
    backBtn.classList.add("hidden");
  }

  // Render Breadcrumbs
  breadcrumbs.innerHTML = dirState.history
    .map((crumb, index) => {
      if (index === dirState.history.length - 1) {
        return `<li class="breadcrumb-item active" aria-current="page">${crumb.name}</li>`;
      }
      return `<li class="breadcrumb-item text-primary" style="cursor: pointer;" onclick="navigateDirectoryTo(${index})">${crumb.name}</li>`;
    })
    .join("");

  // Update Add Button Text
  const addLabels = {
    schools: "School",
    courses: "Course",
    iterations: "Iteration",
    items: "File",
  };
  addBtn.textContent = `➕ Add ${addLabels[current.level]}`;

  // Fetch Data
  try {
    const token = await clerk.session.getToken();
    let url = `/api/admin/directory?level=${current.level}`;
    if (current.parentId) url += `&parentId=${current.parentId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    if (data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">No items found here.</td></tr>`;
      return;
    }

    // Render Table Rows
    tbody.innerHTML = data.data
      .map((item) => {
        // "Open" button logic: Next level down
        const nextLevels = {
          schools: "courses",
          courses: "iterations",
          iterations: "items",
        };
        const nextLevel = nextLevels[current.level];

        const openBtn = nextLevel
          ? `<button class="btn btn-sm btn-outline-primary px-3 me-2" onclick="drillDownDirectory('${nextLevel}', '${item.id}', '${item.name.replace(/'/g, "\\'")}')">📂 Open</button>`
          : ""; // Items don't drill down further

        // Pass stringified item to edit to pre-fill the modal
        const safeItem = JSON.stringify(item).replace(/"/g, "&quot;");

        // Visual enhancements for items
        let displayName = item.name;
        let displayDetails = item.details;
        if (current.level === "items") {
          if (item.is_flagged)
            displayName +=
              ' <span class="badge bg-danger ms-2" title="Flagged for review">🚩</span>';
          const statusColor =
            item.details === "approved"
              ? "bg-success"
              : item.details === "pending"
                ? "bg-warning text-dark"
                : "bg-secondary";
          displayDetails = `<span class="badge ${statusColor}">${item.details}</span>`;
        }

        return `
                        <tr>
                            <td class="fw-semibold">${displayName}</td>
                            <td class="text-muted">${displayDetails}</td>
                            <td class="text-end pe-4">
                                ${openBtn}
                                <button class="btn btn-sm btn-outline-secondary px-2 me-1" onclick="openDirModal('edit', '${safeItem}')">✎ Edit</button>
                                <button class="btn btn-sm btn-outline-danger px-2" onclick="deleteDirItem('${item.id}')">🗑️ Delete</button>
                            </td>
                        </tr>
                    `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">Error loading directory.</td></tr>`;
    console.error(err);
  }
}

// Navigation Helpers (Needs to be attached to window since we used inline onclick for dynamically generated elements)
window.drillDownDirectory = (nextLevel, parentId, name) => {
  dirState.history.push({ level: nextLevel, parentId, name });
  loadDirectory(window.clerkInstance);
};

window.navigateDirectoryTo = (historyIndex) => {
  // Cut history array down to the clicked index
  dirState.history = dirState.history.slice(0, historyIndex + 1);
  loadDirectory(window.clerkInstance);
};

// Wire up the physical Back Button
document.getElementById("dir-back-btn").addEventListener("click", () => {
  if (dirState.history.length > 1) {
    dirState.history.pop();
    loadDirectory(window.clerkInstance);
  }
});

document.getElementById("dir-add-btn").addEventListener("click", () => {
  openDirModal("add");
});

// --- DIRECTORY CRUD LOGIC ---

window.openDirModal = (action, itemStr = null) => {
  const currentLevel = dirState.history[dirState.history.length - 1].level;
  if (currentLevel === "items" && action === "add") {
    alert("Please add files through the public course pages.");
    return;
  }

  const item = itemStr ? JSON.parse(itemStr) : null;
  const modal = new bootstrap.Modal(document.getElementById("directoryModal"));

  document.getElementById("dir-action").value = action;
  document.getElementById("dir-item-id").value = item ? item.id : "";
  document.getElementById("dir-modal-title").textContent =
    `${action === "add" ? "Add" : "Edit"} ${currentLevel.slice(0, -1)}`;
  document.getElementById("dir-modal-error").classList.add("hidden");

  const fieldsContainer = document.getElementById("dir-dynamic-fields");

  // Generate dynamic inputs based on level
  if (currentLevel === "schools") {
    fieldsContainer.innerHTML = `
            <div class="mb-3"><label class="form-label">Abbreviation</label><input type="text" id="dir-input-1" class="form-control" required value="${item ? item.details : ""}"></div>
            <div class="mb-3"><label class="form-label">Full Name</label><input type="text" id="dir-input-2" class="form-control" required value="${item ? item.name : ""}"></div>
        `;
  } else if (currentLevel === "courses") {
    fieldsContainer.innerHTML = `
            <div class="mb-3"><label class="form-label">Course Code</label><input type="text" id="dir-input-1" class="form-control" required value="${item ? item.details : ""}"></div>
            <div class="mb-3"><label class="form-label">Course Title</label><input type="text" id="dir-input-2" class="form-control" required value="${item ? item.name : ""}"></div>
        `;
  } else if (currentLevel === "iterations") {
    // Extract existing values if editing
    let yr = "",
      sm = "FA",
      inst = "";
    if (item) {
      [yr, sm] = item.name.split(" ");
      inst = item.details.replace("Instructor: ", "");
    }
    fieldsContainer.innerHTML = `
            <div class="mb-3"><label class="form-label">Year</label><input type="number" id="dir-input-1" class="form-control" required value="${yr}"></div>
            <div class="mb-3"><label class="form-label">Semester</label><input type="text" id="dir-input-2" class="form-control" placeholder="FA, SP, Even, Odd" required value="${sm}"></div>
            <div class="mb-3"><label class="form-label">Instructor</label><input type="text" id="dir-input-3" class="form-control" required value="${inst}"></div>
        `;
  } else if (currentLevel === "items") {
    const desc = item && item.description ? item.description : "";
    const status = item ? item.details : "approved"; // details holds status for items
    const isFlagged = item && item.is_flagged ? "checked" : "";

    fieldsContainer.innerHTML = `
              <div class="mb-3">
                  <label class="form-label fw-semibold">File Name</label>
                  <input type="text" id="dir-input-1" class="form-control" required value="${item ? item.name : ""}">
              </div>
              <div class="mb-3">
                  <label class="form-label fw-semibold">Description</label>
                  <textarea id="dir-input-2" class="form-control" rows="2" placeholder="Optional context...">${desc}</textarea>
              </div>
              <div class="row">
                  <div class="col-md-6 mb-3">
                      <label class="form-label fw-semibold">Status</label>
                      <select id="dir-input-3" class="form-select">
                          <option value="approved" ${status === "approved" ? "selected" : ""}>Approved</option>
                          <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
                          <option value="rejected" ${status === "rejected" ? "selected" : ""}>Rejected</option>
                      </select>
                  </div>
                  <div class="col-md-6 mb-3 d-flex align-items-end pb-2">
                      <div class="form-check">
                          <input class="form-check-input" type="checkbox" id="dir-input-4" ${isFlagged}>
                          <label class="form-check-label text-danger fw-bold" for="dir-input-4">🚩 Flagged</label>
                      </div>
                  </div>
              </div>
          `;
  }

  modal.show();
};

document
  .getElementById("directory-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("dir-submit-btn");
    const errorDiv = document.getElementById("dir-modal-error");
    const action = document.getElementById("dir-action").value; // 'add' or 'edit'
    const id = document.getElementById("dir-item-id").value;
    const current = dirState.history[dirState.history.length - 1];

    btn.disabled = true;
    btn.textContent = "Saving...";

    // Pack payload based on current level
    let payload = {};
    if (current.level === "schools") {
      payload = {
        abbr: document.getElementById("dir-input-1").value,
        name: document.getElementById("dir-input-2").value,
      };
    } else if (current.level === "courses") {
      payload = {
        code: document.getElementById("dir-input-1").value,
        name: document.getElementById("dir-input-2").value,
      };
    } else if (current.level === "iterations") {
      payload = {
        year: document.getElementById("dir-input-1").value,
        sem: document.getElementById("dir-input-2").value,
        inst: document.getElementById("dir-input-3").value,
      };
    } else if (current.level === "items") {
      payload = {
        name: document.getElementById("dir-input-1").value,
        description: document.getElementById("dir-input-2").value,
        status: document.getElementById("dir-input-3").value,
        is_flagged: document.getElementById("dir-input-4").checked ? 1 : 0,
      };
    }

    try {
      const token = await window.clerkInstance.session.getToken();
      const res = await fetch("/api/admin/directory", {
        method: action === "add" ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          level: current.level,
          id,
          parentId: current.parentId,
          payload,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      bootstrap.Modal.getInstance(
        document.getElementById("directoryModal"),
      ).hide();
      loadDirectory(window.clerkInstance); // Refresh the table
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Changes";
    }
  });

window.deleteDirItem = async (id) => {
  if (
    !confirm(
      "Are you sure you want to delete this? This action cannot be undone.",
    )
  )
    return;

  const currentLevel = dirState.history[dirState.history.length - 1].level;

  try {
    const token = await window.clerkInstance.session.getToken();
    const res = await fetch("/api/admin/directory", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ level: currentLevel, id }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    loadDirectory(window.clerkInstance); // Refresh the table
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
};

// Add this near the bottom of js/admin.js
function setupActionListeners(clerk) {
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("queue-action-btn")) {
      const btn = e.target;
      const type = btn.getAttribute("data-type"); // 'user' or 'course'
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action"); // 'approve' or 'reject'

      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "...";

      try {
        const token = await clerk.session.getToken();
        const res = await fetch("/api/admin/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type, id, action }),
        });

        const data = await res.json();

        if (data.success) {
          await loadPendingQueues(clerk);
          if (allUsersData.length > 0) {
            await loadUserDatabase(clerk); // Refresh the global directory too
          }
        } else {
          throw new Error(data.error);
        }
      } catch (err) {
        alert(`Action failed: ${err.message}`);
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });
}
