import { CONFIG } from "./config.js";

// Dynamically injects Clerk v5 and waits for it to load
export async function initializeClerk() {
  return new Promise((resolve, reject) => {
    if (window.Clerk) return resolve(window.Clerk);

    const script = document.createElement("script");
    // Pinning to v5 ensures UI components load correctly in vanilla JS
    script.src =
      "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
    script.setAttribute(
      "data-clerk-publishable-key",
      CONFIG.CLERK_PUBLISHABLE_KEY,
    );
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = async () => {
      try {
        await window.Clerk.load();
        resolve(window.Clerk);
      } catch (error) {
        console.error("Failed to load Clerk:", error);
        reject(error);
      }
    };

    script.onerror = () =>
      reject(new Error("Network error loading Clerk script"));
    document.body.appendChild(script);
  });
}

// Fetches the synced D1 profile for the logged-in user
export async function fetchUserProfile() {
  if (!window.Clerk || !window.Clerk.session) return null;

  const token = await window.Clerk.session.getToken();
  const res = await fetch(`${CONFIG.API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Failed to fetch user from D1");
  return await res.json();
}
