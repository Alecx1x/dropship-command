"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

/**
 * Server action for the login form. Returns an error message string to render,
 * or never returns on success (signIn throws a redirect that must propagate).
 */
export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return "Invalid email or password.";
      }
      return "Something went wrong. Please try again.";
    }
    // Re-throw NEXT_REDIRECT (success) and any other non-auth error.
    throw error;
  }
}
