export async function mountSidebar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // 1. Robust path detection (handles with or without .html)
  const urlParams = new URLSearchParams(window.location.search);
  const path = window.location.pathname.toLowerCase();

  let targetSchool = path.includes("school")
    ? urlParams.get("abbr")?.toUpperCase()
    : null;
  let targetCourse = path.includes("course") ? urlParams.get("id") : null;
  let targetIter = path.includes("iteration") ? urlParams.get("id") : null;

  container.innerHTML = `<div class="text-muted small p-3">Loading directory...</div>`;

  try {
    const res = await fetch("/api/tree");
    const data = await res.json();

    if (!data.success) throw new Error("Failed to load tree");

    // 2. Trace parents to auto-expand the tree up to the current page
    if (targetIter) {
      for (const s of data.tree) {
        for (const c of s.courses) {
          if (c.iterations.some((i) => i.id === targetIter)) {
            targetCourse = c.id;
            targetSchool = s.abbr;
          }
        }
      }
    } else if (targetCourse) {
      for (const s of data.tree) {
        if (s.courses.some((c) => c.id === targetCourse)) {
          targetSchool = s.abbr;
        }
      }
    }

    // 3. Render using HTML5 <details> for native accordion behavior
    let html = `<div class="directory-tree">`;

    data.tree.forEach((school) => {
      const isSchoolOpen = school.abbr === targetSchool ? "open" : "";
      const schoolColor = isSchoolOpen ? "text-primary" : "text-dark";

      html += `
                <details class="tree-node mb-1" ${isSchoolOpen}>
                    <summary class="fw-bold">
                        <a href="/school.html?abbr=${school.abbr}" class="tree-link ${schoolColor}">${school.abbr}</a>
                    </summary>
                    <div class="tree-branch">
            `;

      school.courses.forEach((course) => {
        const isCourseOpen = course.id === targetCourse ? "open" : "";
        const courseColor = isCourseOpen
          ? "text-primary fw-semibold"
          : "text-muted";

        html += `
                    <details class="tree-node mb-1" ${isCourseOpen}>
                        <summary>
                            <a href="/course.html?id=${course.id}" class="tree-link ${courseColor}">${course.code}</a>
                        </summary>
                        <div class="tree-branch">
                `;

        course.iterations.forEach((iter) => {
          const isIterActive = iter.id === targetIter;
          const iterColor = isIterActive
            ? "text-primary fw-bold"
            : "text-muted";

          // Changed <div class="tree-node"> to <details class="tree-node no-children">
          html += `
                                        <details class="tree-node no-children ms-3 mb-1">
                                            <summary>
                                                <a href="/iteration.html?id=${iter.id}" class="tree-link small ${iterColor}">
                                                    📄 ${iter.year} ${iter.sem}
                                                </a>
                                            </summary>
                                        </details>
                                    `;
        });

        html += `</div></details>`;
      });

      html += `</div></details>`;
    });

    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="text-danger small p-3">Tree unavailable.</div>`;
  }
}
