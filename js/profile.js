import { Style, Avatar } from 'https://esm.sh/@dicebear/core@10.2.0';

document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById('profile-form');
    const spinner = document.getElementById('loading-spinner');

    // UI Input Elements Mapping
    const UI = {
        bgCol: document.getElementById('av-bg-color'),
        skinCol: document.getElementById('av-skin-color'),
        hairCol: document.getElementById('av-hair-color'),
        hatCol: document.getElementById('av-hat-color'),
        accCol: document.getElementById('av-acc-color'),
        facialCol: document.getElementById('av-facial-color'),
        clothesCol: document.getElementById('av-clothes-color'),

        top: document.getElementById('av-top'),
        eyes: document.getElementById('av-eyes'),
        mouth: document.getElementById('av-mouth'),
        eyebrows: document.getElementById('av-eyebrows'),
        facialHair: document.getElementById('av-facial-hair'),
        acc: document.getElementById('av-acc'),
        clothes: document.getElementById('av-clothes'),
        clothesGraphic: document.getElementById('av-clothes-graphic')
    };

    const avatarPreview = document.getElementById('avatar-preview');
    const avatarInputs = document.querySelectorAll('.avatar-input');

    // 1. Fetch the Avataaars Definition JSON for the local renderer
    let avataaarsStyle;
    try {
        const styleRes = await fetch('https://cdn.hopjs.net/npm/@dicebear/styles@10.2.0/dist/avataaars.min.json');
        const styleDef = await styleRes.json();
        avataaarsStyle = new Style(styleDef);
    } catch (e) {
        console.error("Failed to load local avatar styles:", e);
    }

    // 2. Fetch Key and Initialize Clerk
    try {
        const configRes = await fetch('/api/config');
        if (!configRes.ok) throw new Error(`Config endpoint returned ${configRes.status}`);

        const config = await configRes.json();
        if (!config.clerkPublishableKey) throw new Error("Missing Clerk Publishable Key in response.");

        const script = document.createElement('script');
        script.setAttribute('data-clerk-publishable-key', config.clerkPublishableKey);
        script.async = true;
        script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@4/dist/clerk.browser.js';
        script.crossOrigin = 'anonymous';

        script.onload = async () => {
            try {
                await window.Clerk.load();
                if (!window.Clerk.user) {
                    spinner.innerHTML = `
                        <div class="alert alert-warning" role="alert">
                            <h4 class="alert-heading">Not Authenticated</h4>
                            <hr><button class="btn btn-primary mt-2" id="debug-signin-btn">Sign In Now</button>
                        </div>
                    `;
                    document.getElementById('debug-signin-btn').addEventListener('click', () => { window.Clerk.openSignIn(); });
                    return;
                }
                await loadProfileData();
            } catch (clerkError) {
                spinner.innerHTML = `<p class="text-danger">Error loading Clerk: ${clerkError.message}</p>`;
            }
        };

        document.body.appendChild(script);
    } catch (error) {
        spinner.innerHTML = `<div class="alert alert-danger">Failed to initialize: ${error.message}</div>`;
    }

    // 3. Load Profile Data
    async function loadProfileData() {
        try {
            const token = await window.Clerk.session.getToken();
            const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();

            if (data.user) {
                document.getElementById('profile-name').value = data.user.name || data.user.username || '';
                document.getElementById('profile-school').value = data.user.school_abbr || '';
                document.getElementById('profile-program').value = data.user.program || '';
                document.getElementById('profile-batch').value = data.user.batch || '';
                document.getElementById('profile-about').value = data.user.about || '';

                if (data.user.avatar_config && data.user.avatar_config !== '?seed=default') {
                    const params = new URLSearchParams(data.user.avatar_config.replace('?', ''));

                    // Populate DOM from parameters
                    if (params.has('backgroundColor')) UI.bgCol.value = '#' + params.get('backgroundColor');
                    if (params.has('skinColor')) UI.skinCol.value = '#' + params.get('skinColor');
                    if (params.has('hairColor')) UI.hairCol.value = '#' + params.get('hairColor');
                    if (params.has('hatColor')) UI.hatCol.value = '#' + params.get('hatColor');
                    if (params.has('accessoriesColor')) UI.accCol.value = '#' + params.get('accessoriesColor');
                    if (params.has('facialHairColor')) UI.facialCol.value = '#' + params.get('facialHairColor');
                    if (params.has('clothesColor')) UI.clothesCol.value = '#' + params.get('clothesColor');

                    if (params.has('topVariant')) UI.top.value = params.get('topVariant');
                    if (params.has('eyesVariant')) UI.eyes.value = params.get('eyesVariant');
                    if (params.has('mouthVariant')) UI.mouth.value = params.get('mouthVariant');
                    if (params.has('eyebrowsVariant')) UI.eyebrows.value = params.get('eyebrowsVariant');
                    if (params.has('clothesVariant')) UI.clothes.value = params.get('clothesVariant');
                    if (params.has('clothesGraphicVariant')) UI.clothesGraphic.value = params.get('clothesGraphicVariant');

                    if (params.has('accessoriesVariant')) UI.acc.value = params.get('accessoriesVariant');
                    if (params.has('facialHairVariant')) UI.facialHair.value = params.get('facialHairVariant');
                }
            }

            updateAvatarPreview();
            spinner.style.display = 'none';
            form.style.display = 'block';

        } catch (error) {
            spinner.innerHTML = `<div class="alert alert-danger">Error loading profile data: ${error.message}</div>`;
        }
    }

    // 4. Client-Side Avatar Generation (Instant)
    function updateAvatarPreview() {
        if (!avataaarsStyle) return;

        try {
            const nameSeed = document.getElementById('profile-name').value.trim() || 'default';

            const options = {
                seed: nameSeed,
                backgroundColor: [UI.bgCol.value.replace('#', '')],
                skinColor: [UI.skinCol.value.replace('#', '')],
                hairColor: [UI.hairCol.value.replace('#', '')],
                hatColor: [UI.hatCol.value.replace('#', '')],
                clothesColor: [UI.clothesCol.value.replace('#', '')],
                accessoriesColor: [UI.accCol.value.replace('#', '')],
                facialHairColor: [UI.facialCol.value.replace('#', '')],

                topVariant: [UI.top.value],
                eyesVariant: [UI.eyes.value],
                mouthVariant: [UI.mouth.value],
                eyebrowsVariant: [UI.eyebrows.value],
                clothesVariant: [UI.clothes.value],
                clothesGraphicVariant: [UI.clothesGraphic.value]
            };

            // Optional items: Only pass probability = 100 if a value is selected, else 0
            if (UI.acc.value) {
                options.accessoriesVariant = [UI.acc.value];
                options.accessoriesProbability = 100;
            } else {
                options.accessoriesProbability = 0;
            }

            if (UI.facialHair.value) {
                options.facialHairVariant = [UI.facialHair.value];
                options.facialHairProbability = 100;
            } else {
                options.facialHairProbability = 0;
            }

            // Generate synchronously and convert to base64 Data URI
            const avatar = new Avatar(avataaarsStyle, options);
            avatarPreview.src = avatar.toDataUri();

        } catch (err) {
            console.error("Avatar rendering failed:", err);
        }
    }

    // Listen to changes for instant updates
    avatarInputs.forEach(input => {
        input.addEventListener('input', updateAvatarPreview);
        input.addEventListener('change', updateAvatarPreview);
    });
    document.getElementById('profile-name').addEventListener('input', updateAvatarPreview);

    // 5. Save Profile
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-profile-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = 'Saving...';

        try {
            const token = await window.Clerk.session.getToken();

            // Construct configuration for DB storage / HTTP API rendering across the app
            const params = new URLSearchParams({
                backgroundColor: UI.bgCol.value.replace('#', ''),
                skinColor: UI.skinCol.value.replace('#', ''),
                hairColor: UI.hairCol.value.replace('#', ''),
                hatColor: UI.hatCol.value.replace('#', ''),
                clothesColor: UI.clothesCol.value.replace('#', ''),
                accessoriesColor: UI.accCol.value.replace('#', ''),
                facialHairColor: UI.facialCol.value.replace('#', ''),

                topVariant: UI.top.value,
                eyesVariant: UI.eyes.value,
                mouthVariant: UI.mouth.value,
                eyebrowsVariant: UI.eyebrows.value,
                clothesVariant: UI.clothes.value,
                clothesGraphicVariant: UI.clothesGraphic.value
            });

            if (UI.acc.value) {
                params.set('accessoriesVariant', UI.acc.value);
                params.set('accessoriesProbability', 100);
            } else {
                params.set('accessoriesProbability', 0);
            }

            if (UI.facialHair.value) {
                params.set('facialHairVariant', UI.facialHair.value);
                params.set('facialHairProbability', 100);
            } else {
                params.set('facialHairProbability', 0);
            }

            const payload = {
                name: document.getElementById('profile-name').value,
                school_abbr: document.getElementById('profile-school').value,
                program: document.getElementById('profile-program').value,
                batch: parseInt(document.getElementById('profile-batch').value, 10) || null,
                about: document.getElementById('profile-about').value,
                avatar_config: params.toString()
            };

            const response = await fetch('/api/users/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to update profile");
            alert("Profile updated successfully!");

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Profile';
        }
    });

    // 6. Clerk Account Settings
    const accountTab = document.getElementById('account-tab');
    const clerkContainer = document.getElementById('clerk-user-profile-container');
    let isClerkMounted = false;

    accountTab.addEventListener('shown.bs.tab', function () {
        if (!isClerkMounted && window.Clerk) {
            window.Clerk.mountUserProfile(clerkContainer);
            isClerkMounted = true;
        }
    });
});
