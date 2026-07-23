export async function onRequestGet(context) {
    return Response.json({
        clerkPublishableKey: context.env.CLERK_PUBLISHABLE_KEY
    });
}
